import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus, Project, ProjectDocument } from '@/modules/shared/entities';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

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

    await this.delete(id);
    this.logger.log(`Task deleted: ${id}`);
  }

  /**
   * Get tasks by project
   */
  async getTasksByProject(projectId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { projectId: new Types.ObjectId(projectId) },
      { skip, limit },
      { order: 1, createdAt: -1 },
    );
  }

  /**
   * Get tasks by sprint
   */
  async getTasksBySprint(sprintId: string, skip = 0, limit = 100) {
    return this.findWithPagination(
      { sprintId: new Types.ObjectId(sprintId) },
      { skip, limit },
      { order: 1, createdAt: -1 },
    );
  }

  /**
   * Get tasks assigned to user
   */
  async getTasksByAssignee(assigneeId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { assigneeId: new Types.ObjectId(assigneeId) },
      { skip, limit },
      { dueDate: 1 },
    );
  }

  /**
   * Get tasks by status
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
   * Get subtasks
   */
  async getSubtasks(parentId: string, skip = 0, limit = 50) {
    return this.findWithPagination(
      { parentId: new Types.ObjectId(parentId) },
      { skip, limit },
      { order: 1, createdAt: -1 },
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
    return task;
  }

  /**
   * Move task to sprint
   */
  async moveToSprint(taskId: string, sprintId: string | null): Promise<TaskDocument | null> {
    const updateData: Record<string, unknown> = sprintId
      ? { sprintId: new Types.ObjectId(sprintId) }
      : { $unset: { sprintId: 1 } };

    const task = await this.update(taskId, updateData);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    this.logger.log(`Task ${taskId} moved to sprint ${sprintId || 'backlog'}`);
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
    return this.findWithPagination(
      {
        projectId: new Types.ObjectId(projectId),
        sprintId: { $exists: false },
      },
      { skip, limit },
      { order: 1, createdAt: -1 },
    );
  }
}
