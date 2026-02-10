import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TaskActivity,
  TaskActivityDocument,
  TaskActivityAction,
  Task,
  TaskDocument,
} from '@/modules/shared/entities';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

@Injectable()
export class TaskActivitiesService extends BaseRepository<TaskActivityDocument> {
  private readonly logger = new Logger(TaskActivitiesService.name);

  constructor(
    @InjectModel(TaskActivity.name)
    private readonly taskActivityModel: Model<TaskActivityDocument>,
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
  ) {
    super(taskActivityModel);
  }

  /**
   * Log a task activity
   */
  async logActivity(
    taskId: string,
    userId: string,
    action: TaskActivityAction,
    meta?: Record<string, unknown>,
  ): Promise<TaskActivityDocument> {
    const activity = await this.create({
      taskId: new Types.ObjectId(taskId),
      userId: new Types.ObjectId(userId),
      action,
      meta,
    } as Partial<TaskActivityDocument>);

    this.logger.log(`Activity logged: ${action} on task ${taskId} by user ${userId}`);
    return activity;
  }

  /**
   * Get activities for a task with user details
   */
  async getTaskActivities(taskId: string, skip = 0, limit = 50) {
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    const activities = await this.taskActivityModel
      .find({ taskId: new Types.ObjectId(taskId) })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.count({
      taskId: new Types.ObjectId(taskId),
    });

    // Transform userId populate to user field for frontend
    const data = activities.map((a) => {
      const obj = a.toObject();
      return {
        ...obj,
        user: obj.userId,
        userId: (obj.userId as any)?._id || obj.userId,
      };
    });

    return { data, total };
  }
}
