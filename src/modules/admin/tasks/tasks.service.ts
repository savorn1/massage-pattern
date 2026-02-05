import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from '@/modules/shared/entities';
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
  ) {
    super(taskModel);
  }

  /**
   * Create a new task
   */
  async createTask(
    createTaskDto: CreateTaskDto,
    userId: string,
  ): Promise<TaskDocument> {
    const taskData: Record<string, unknown> = {
      ...createTaskDto,
      projectId: new Types.ObjectId(createTaskDto.projectId),
      reporterId: new Types.ObjectId(userId),
      createdBy: userId,
    };

    if (createTaskDto.milestoneId) {
      taskData.milestoneId = new Types.ObjectId(createTaskDto.milestoneId);
    }

    if (createTaskDto.assigneeId) {
      taskData.assigneeId = new Types.ObjectId(createTaskDto.assigneeId);
    }

    if (createTaskDto.dependencies) {
      taskData.dependencies = createTaskDto.dependencies.map(
        (id) => new Types.ObjectId(id),
      );
    }

    const task = await this.create(taskData);
    this.logger.log(`Task created: ${task.title} by user ${userId}`);
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

    if (updateTaskDto.milestoneId) {
      updateData.milestoneId = new Types.ObjectId(updateTaskDto.milestoneId);
    }

    if (updateTaskDto.assigneeId) {
      updateData.assigneeId = new Types.ObjectId(updateTaskDto.assigneeId);
    }

    if (updateTaskDto.dependencies) {
      updateData.dependencies = updateTaskDto.dependencies.map(
        (id) => new Types.ObjectId(id),
      );
    }

    // Auto-set completedAt when status changes to completed
    if (updateTaskDto.status === TaskStatus.COMPLETED && !updateTaskDto.completedAt) {
      updateData.completedAt = new Date();
    }

    const task = await this.update(id, updateData);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', id);
    }

    this.logger.log(`Task updated: ${id}`);
    return task;
  }

  /**
   * Soft delete task
   */
  async deleteTask(id: string, userId?: string): Promise<TaskDocument | null> {
    const task = await this.softDelete(id, userId);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', id);
    }

    this.logger.log(`Task deleted: ${id}`);
    return task;
  }

  /**
   * Get tasks by project
   */
  async getTasksByProject(projectId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { projectId: new Types.ObjectId(projectId), isDeleted: false },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get tasks by milestone
   */
  async getTasksByMilestone(milestoneId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { milestoneId: new Types.ObjectId(milestoneId), isDeleted: false },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get tasks assigned to user
   */
  async getTasksByAssignee(assigneeId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { assigneeId: new Types.ObjectId(assigneeId), isDeleted: false },
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
        isDeleted: false,
      },
      { skip, limit },
      { createdAt: -1 },
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
   * Update task status
   */
  async updateStatus(taskId: string, status: TaskStatus): Promise<TaskDocument | null> {
    const updateData: Record<string, unknown> = { status };

    if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    const task = await this.update(taskId, updateData);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    this.logger.log(`Task ${taskId} status updated to ${status}`);
    return task;
  }
}
