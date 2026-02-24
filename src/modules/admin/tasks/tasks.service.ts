import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus, Project, ProjectDocument } from '@/modules/shared/entities';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';
import { EventsService, EventType } from '../events/events.service';
import { CacheService } from '@/modules/cache/cache.service';

// ─── Cache TTLs (seconds) ────────────────────────────────────────────────────
const TASK_LIST_TTL = 30;  // short — tasks change often
const TASK_ITEM_TTL = 60;

/**
 * Service for managing tasks
 */
@Injectable()
export class TasksService extends BaseRepository<TaskDocument> {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    private readonly eventsService: EventsService,
    private readonly cacheService: CacheService,
  ) {
    super(taskModel);
  }

  /**
   * Generate task key
   */
  private async generateTaskKey(projectId: string): Promise<string> {
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    const tasks = await this.taskModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .select('key')
      .lean();

    let maxNumber = 0;
    for (const task of tasks) {
      const match = task.key?.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }

    return `${project.key}-${maxNumber + 1}`;
  }

  /**
   * Create a new task
   */
  async createTask(
    createTaskDto: CreateTaskDto,
    userId: string,
    projectId: string,
  ): Promise<TaskDocument> {
    const key = await this.generateTaskKey(projectId);

    const taskData: Partial<Task> = {
      title: createTaskDto.title,
      description: createTaskDto.description,
      type: createTaskDto.type,
      status: createTaskDto.status,
      priority: createTaskDto.priority,
      storyPoints: createTaskDto.storyPoints,
      key,
      projectId: new Types.ObjectId(projectId),
      reporterId: new Types.ObjectId(userId),
    };

    if (createTaskDto.sprintId) {
      taskData.sprintId = new Types.ObjectId(createTaskDto.sprintId);
    }

    if (createTaskDto.assigneeId) {
      taskData.assigneeId = new Types.ObjectId(createTaskDto.assigneeId);
    }

    if (createTaskDto.labelIds) {
      taskData.labelIds = createTaskDto.labelIds.map((id) => new Types.ObjectId(id));
    }

    if (createTaskDto.parentId) {
      taskData.parentId = new Types.ObjectId(createTaskDto.parentId);
    }

    if (createTaskDto.dueDate) {
      taskData.dueDate = new Date(createTaskDto.dueDate);
    }

    const task = await this.create(taskData as Partial<TaskDocument>);
    this.logger.log(`Task created: ${task.title} (${task.key}) by user ${userId}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    await this.cacheService.delPattern(`tasks:project:${projectId}:*`);
    await this.cacheService.delPattern(`tasks:backlog:${projectId}:*`);
    if (createTaskDto.sprintId) {
      await this.cacheService.delPattern(`tasks:sprint:${createTaskDto.sprintId}:*`);
    }

    // Emit real-time event
    await this.eventsService.emitTaskEvent({
      type: EventType.TASK_CREATED,
      task: task.toObject(),
      projectId: projectId,
      userId,
      timestamp: new Date().toISOString(),
    });

    return task;
  }

  /**
   * Update task
   */
  async updateTask(
    id: string,
    updateTaskDto: UpdateTaskDto,
  ): Promise<TaskDocument | null> {
    const updateData: Record<string, unknown> = { ...updateTaskDto };

    if (updateTaskDto.sprintId) {
      updateData.sprintId = new Types.ObjectId(updateTaskDto.sprintId);
    }

    if (updateTaskDto.assigneeId) {
      updateData.assigneeId = new Types.ObjectId(updateTaskDto.assigneeId);
    }

    if (updateTaskDto.labelIds) {
      updateData.labelIds = updateTaskDto.labelIds.map((id) => new Types.ObjectId(id));
    }

    if (updateTaskDto.parentId) {
      updateData.parentId = new Types.ObjectId(updateTaskDto.parentId);
    }

    if (updateTaskDto.dueDate) {
      updateData.dueDate = new Date(updateTaskDto.dueDate);
    }

    const task = await this.update(id, updateData);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', id);
    }

    this.logger.log(`Task updated: ${id}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    const projectId = task.projectId.toString();
    await Promise.all([
      this.cacheService.del(`tasks:id:${id}`),
      this.cacheService.delPattern(`tasks:project:${projectId}:*`),
      this.cacheService.delPattern(`tasks:backlog:${projectId}:*`),
    ]);
    if (updateTaskDto.sprintId) {
      await this.cacheService.delPattern(`tasks:sprint:${updateTaskDto.sprintId}:*`);
    }
    if (updateTaskDto.assigneeId) {
      await this.cacheService.delPattern(`tasks:assignee:${updateTaskDto.assigneeId}:*`);
    }

    // Emit real-time event
    await this.eventsService.emitTaskEvent({
      type: EventType.TASK_UPDATED,
      task: task.toObject(),
      projectId: task.projectId.toString(),
      timestamp: new Date().toISOString(),
    });

    return task;
  }

  /**
   * Delete task
   */
  async deleteTask(id: string): Promise<void> {
    const task = await this.findById(id);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', id);
    }

    const projectId = task.projectId.toString();
    const taskData = task.toObject();

    await this.delete(id);
    this.logger.log(`Task deleted: ${id}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    await Promise.all([
      this.cacheService.del(`tasks:id:${id}`),
      this.cacheService.delPattern(`tasks:project:${projectId}:*`),
      this.cacheService.delPattern(`tasks:backlog:${projectId}:*`),
    ]);
    if (task.sprintId) {
      await this.cacheService.delPattern(`tasks:sprint:${task.sprintId.toString()}:*`);
    }

    // Emit real-time event
    await this.eventsService.emitTaskEvent({
      type: EventType.TASK_DELETED,
      task: { _id: id, ...taskData },
      projectId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get tasks by project
   *
   * Cache-aside: results are cached in Redis for TASK_LIST_TTL seconds.
   * Any mutation (create / update / delete) calls delPattern to bust these keys.
   */
  async getTasksByProject(projectId: string, skip = 0, limit = 10) {
    const key = `tasks:project:${projectId}:${skip}:${limit}`;
    return this.cacheService.getOrSet(
      key,
      () => this.findWithPagination(
        { projectId: new Types.ObjectId(projectId) },
        { skip, limit },
        { order: 1, createdAt: -1 },
      ),
      TASK_LIST_TTL,
    );
  }

  /**
   * Get tasks by sprint
   */
  async getTasksBySprint(sprintId: string, skip = 0, limit = 100) {
    const key = `tasks:sprint:${sprintId}:${skip}:${limit}`;
    return this.cacheService.getOrSet(
      key,
      () => this.findWithPagination(
        { sprintId: new Types.ObjectId(sprintId) },
        { skip, limit },
        { order: 1, createdAt: -1 },
      ),
      TASK_LIST_TTL,
    );
  }

  /**
   * Get tasks assigned to user
   */
  async getTasksByAssignee(assigneeId: string, skip = 0, limit = 10) {
    const key = `tasks:assignee:${assigneeId}:${skip}:${limit}`;
    return this.cacheService.getOrSet(
      key,
      () => this.findWithPagination(
        { assigneeId: new Types.ObjectId(assigneeId) },
        { skip, limit },
        { dueDate: 1 },
      ),
      TASK_LIST_TTL,
    );
  }

  /**
   * Get tasks by status (not cached — status changes are very frequent on kanban boards)
   */
  async getTasksByStatus(projectId: string, status: TaskStatus, skip = 0, limit = 10) {
    return this.findWithPagination(
      {
        projectId: new Types.ObjectId(projectId),
        status,
      },
      { skip, limit },
      { order: 1, createdAt: -1 },
    );
  }

  /**
   * Get subtasks — cached with longer TTL since subtask lists change rarely
   */
  async getSubtasks(parentId: string, skip = 0, limit = 50) {
    const key = `tasks:subtasks:${parentId}:${skip}:${limit}`;
    return this.cacheService.getOrSet(
      key,
      () => this.findWithPagination(
        { parentId: new Types.ObjectId(parentId) },
        { skip, limit },
        { order: 1, createdAt: -1 },
      ),
      TASK_ITEM_TTL,
    );
  }

  /**
   * Assign task to user
   */
  async assignTask(taskId: string, assigneeId: string): Promise<TaskDocument | null> {
    const task = await this.update(taskId, {
      assigneeId: new Types.ObjectId(assigneeId),
    });

    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    this.logger.log(`Task ${taskId} assigned to user ${assigneeId}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    await Promise.all([
      this.cacheService.del(`tasks:id:${taskId}`),
      this.cacheService.delPattern(`tasks:project:${task.projectId.toString()}:*`),
      this.cacheService.delPattern(`tasks:assignee:${assigneeId}:*`),
    ]);

    return task;
  }

  /**
   * Unassign task
   */
  async unassignTask(taskId: string): Promise<TaskDocument | null> {
    const task = await this.update(taskId, {
      $unset: { assigneeId: 1 },
    });

    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    this.logger.log(`Task ${taskId} unassigned`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    await Promise.all([
      this.cacheService.del(`tasks:id:${taskId}`),
      this.cacheService.delPattern(`tasks:project:${task.projectId.toString()}:*`),
    ]);

    return task;
  }

  /**
   * Update task status
   */
  async updateStatus(taskId: string, status: TaskStatus): Promise<TaskDocument | null> {
    const task = await this.update(taskId, { status });
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    this.logger.log(`Task ${taskId} status updated to ${status}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    await Promise.all([
      this.cacheService.del(`tasks:id:${taskId}`),
      this.cacheService.delPattern(`tasks:project:${task.projectId.toString()}:*`),
    ]);

    return task;
  }

  /**
   * Move task to sprint
   */
  async moveToSprint(taskId: string, sprintId: string | null): Promise<TaskDocument | null> {
    // Fetch before update so we can bust the old sprint's cache
    const oldTask = await this.findById(taskId);

    const updateData: Record<string, unknown> = sprintId
      ? { sprintId: new Types.ObjectId(sprintId) }
      : { $unset: { sprintId: 1 } };

    const task = await this.update(taskId, updateData);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    this.logger.log(`Task ${taskId} moved to sprint ${sprintId || 'backlog'}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    const busts: Promise<unknown>[] = [
      this.cacheService.del(`tasks:id:${taskId}`),
      this.cacheService.delPattern(`tasks:project:${task.projectId.toString()}:*`),
      this.cacheService.delPattern(`tasks:backlog:${task.projectId.toString()}:*`),
    ];
    if (sprintId) busts.push(this.cacheService.delPattern(`tasks:sprint:${sprintId}:*`));
    if (oldTask?.sprintId) busts.push(this.cacheService.delPattern(`tasks:sprint:${oldTask.sprintId.toString()}:*`));
    await Promise.all(busts);

    return task;
  }

  /**
   * Reorder tasks
   */
  async reorderTasks(taskOrders: { taskId: string; order: number }[]): Promise<void> {
    const bulkOps = taskOrders.map(({ taskId, order }) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(taskId) },
        update: { $set: { order } },
      },
    }));

    await this.taskModel.bulkWrite(bulkOps);
    this.logger.log(`Reordered ${taskOrders.length} tasks`);

    // Emit real-time event (get projectId from first task)
    if (taskOrders.length > 0) {
      const firstTask = await this.findById(taskOrders[0].taskId);
      if (firstTask) {
        const projectId = firstTask.projectId.toString();

        // ── Cache invalidation ────────────────────────────────────────────
        await this.cacheService.delPattern(`tasks:project:${projectId}:*`);

        await this.eventsService.emitTaskEvent({
          type: EventType.TASK_REORDERED,
          task: { taskOrders },
          projectId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Add labels to task
   */
  async addLabels(taskId: string, labelIds: string[]): Promise<TaskDocument | null> {
    const task = await this.update(taskId, {
      $addToSet: { labelIds: { $each: labelIds.map((id) => new Types.ObjectId(id)) } },
    });

    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    this.logger.log(`Labels added to task ${taskId}`);
    return task;
  }

  /**
   * Remove labels from task
   */
  async removeLabels(taskId: string, labelIds: string[]): Promise<TaskDocument | null> {
    const task = await this.update(taskId, {
      $pull: { labelIds: { $in: labelIds.map((id) => new Types.ObjectId(id)) } },
    });

    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    this.logger.log(`Labels removed from task ${taskId}`);
    return task;
  }

  /**
   * Get task by key
   */
  async findByKey(projectId: string, key: string): Promise<TaskDocument | null> {
    return this.findOne({
      projectId: new Types.ObjectId(projectId),
      key,
    });
  }

  /**
   * Get backlog tasks (tasks without sprint)
   */
  async getBacklogTasks(projectId: string, skip = 0, limit = 50) {
    const key = `tasks:backlog:${projectId}:${skip}:${limit}`;
    return this.cacheService.getOrSet(
      key,
      () => this.findWithPagination(
        {
          projectId: new Types.ObjectId(projectId),
          sprintId: { $exists: false },
        },
        { skip, limit },
        { order: 1, createdAt: -1 },
      ),
      TASK_LIST_TTL,
    );
  }

  /**
   * Get task counts grouped by status for a project
   */
  async getTaskCountsByProject(projectId: string): Promise<{ total: number; byStatus: Record<string, number> }> {
    const rows = await this.taskModel.aggregate<{ _id: string; count: number }>([
      { $match: { projectId: new Types.ObjectId(projectId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      byStatus[row._id] = row.count;
      total += row.count;
    }
    return { total, byStatus };
  }
}
