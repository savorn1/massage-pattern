import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TaskComment,
  TaskCommentDocument,
  Task,
  TaskDocument,
  User,
  UserDocument,
} from '@/modules/shared/entities';
import { CreateTaskCommentDto } from './dto/create-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-comment.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing task comments
 */
@Injectable()
export class TaskCommentsService extends BaseRepository<TaskCommentDocument> {
  private readonly logger = new Logger(TaskCommentsService.name);

  constructor(
    @InjectModel(TaskComment.name)
    private readonly taskCommentModel: Model<TaskCommentDocument>,
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {
    super(taskCommentModel);
  }

  /**
   * Create a new comment on a task
   */
  async createComment(
    taskId: string,
    userId: string,
    createCommentDto: CreateTaskCommentDto,
  ): Promise<TaskCommentDocument> {
    // Verify task exists
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    // Verify user exists
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw BusinessException.resourceNotFound('User', userId);
    }

    const commentData: Partial<TaskComment> = {
      ...createCommentDto,
      taskId: new Types.ObjectId(taskId),
      userId: new Types.ObjectId(userId),
    };

    const comment = await this.create(commentData as Partial<TaskCommentDocument>);
    this.logger.log(
      `Comment created on task ${taskId} by user ${userId}`,
    );
    return comment;
  }

  /**
   * Find comment by ID
   */
  async findCommentById(id: string): Promise<TaskCommentDocument> {
    const comment = await this.findById(id);
    if (!comment) {
      throw BusinessException.resourceNotFound('TaskComment', id);
    }
    return comment;
  }

  /**
   * Update a comment
   */
  async updateComment(
    id: string,
    userId: string,
    updateCommentDto: UpdateTaskCommentDto,
  ): Promise<TaskCommentDocument> {
    const comment = await this.findById(id);
    if (!comment) {
      throw BusinessException.resourceNotFound('TaskComment', id);
    }

    // Only the author can update the comment
    if (comment.userId.toString() !== userId) {
      throw BusinessException.invalidOperation(
        'You can only edit your own comments',
      );
    }

    const updatedComment = await this.update(id, updateCommentDto);
    if (!updatedComment) {
      throw BusinessException.resourceNotFound('TaskComment', id);
    }

    this.logger.log(`Comment updated: ${id}`);
    return updatedComment;
  }

  /**
   * Delete a comment
   */
  async deleteComment(
    id: string,
    userId: string,
    isAdmin = false,
  ): Promise<void> {
    const comment = await this.findById(id);
    if (!comment) {
      throw BusinessException.resourceNotFound('TaskComment', id);
    }

    // Only the author or an admin can delete the comment
    if (!isAdmin && comment.userId.toString() !== userId) {
      throw BusinessException.invalidOperation(
        'You can only delete your own comments',
      );
    }

    await this.delete(id);
    this.logger.log(`Comment deleted: ${id} by user ${userId}`);
  }

  /**
   * Get all comments for a task
   */
  async getTaskComments(
    taskId: string,
    skip = 0,
    limit = 50,
  ) {
    // Verify task exists
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    return this.findWithPagination(
      { taskId: new Types.ObjectId(taskId) },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get all comments for a task with user details populated
   */
  async getTaskCommentsWithDetails(
    taskId: string,
    skip = 0,
    limit = 50,
  ) {
    // Verify task exists
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    const comments = await this.taskCommentModel
      .find({ taskId: new Types.ObjectId(taskId) })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.count({
      taskId: new Types.ObjectId(taskId),
    });

    return { data: comments, total };
  }

  /**
   * Get comments by user
   */
  async getUserComments(
    userId: string,
    skip = 0,
    limit = 20,
  ) {
    return this.findWithPagination(
      { userId: new Types.ObjectId(userId) },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get recent comments for a user across all tasks
   */
  async getUserRecentComments(
    userId: string,
    limit = 10,
  ): Promise<TaskCommentDocument[]> {
    return this.taskCommentModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('taskId', 'title key')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get comment count for a task
   */
  async getCommentCount(taskId: string): Promise<number> {
    return this.count({ taskId: new Types.ObjectId(taskId) });
  }

  /**
   * Check if comment belongs to task
   */
  async belongsToTask(
    commentId: string,
    taskId: string,
  ): Promise<boolean> {
    const comment = await this.findById(commentId);
    return comment?.taskId.toString() === taskId;
  }

  /**
   * Check if user is the comment author
   */
  async isAuthor(
    commentId: string,
    userId: string,
  ): Promise<boolean> {
    const comment = await this.findById(commentId);
    return comment?.userId.toString() === userId;
  }

  /**
   * Delete all comments for a task
   */
  async deleteAllTaskComments(taskId: string): Promise<number> {
    // Verify task exists
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    const result = await this.taskCommentModel.deleteMany({
      taskId: new Types.ObjectId(taskId),
    });

    this.logger.log(
      `${result.deletedCount} comments deleted from task ${taskId}`,
    );
    return result.deletedCount || 0;
  }

  /**
   * Get latest comment for a task
   */
  async getLatestComment(taskId: string): Promise<TaskCommentDocument | null> {
    return this.taskCommentModel
      .findOne({ taskId: new Types.ObjectId(taskId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get comments created after a certain date
   */
  async getCommentsAfterDate(
    taskId: string,
    date: Date,
    skip = 0,
    limit = 50,
  ) {
    return this.findWithPagination(
      {
        taskId: new Types.ObjectId(taskId),
        createdAt: { $gt: date },
      },
      { skip, limit },
      { createdAt: 1 },
    );
  }

  /**
   * Search comments by content
   */
  async searchComments(
    taskId: string,
    searchTerm: string,
    skip = 0,
    limit = 20,
  ) {
    // Verify task exists
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw BusinessException.resourceNotFound('Task', taskId);
    }

    return this.findWithPagination(
      {
        taskId: new Types.ObjectId(taskId),
        content: { $regex: searchTerm, $options: 'i' },
      },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get comment statistics for a task
   */
  async getTaskCommentStats(taskId: string) {
    const totalComments = await this.getCommentCount(taskId);

    const result = await this.taskCommentModel.aggregate([
      { $match: { taskId: new Types.ObjectId(taskId) } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return {
      totalComments,
      uniqueCommenters: result.length,
      commentsByUser: result,
    };
  }

  /**
   * Bulk delete comments by IDs
   */
  async bulkDeleteComments(
    ids: string[],
    userId: string,
    isAdmin = false,
  ): Promise<number> {
    // If not admin, filter to only user's own comments
    let filter: Record<string, unknown> = {
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    };

    if (!isAdmin) {
      filter = {
        ...filter,
        userId: new Types.ObjectId(userId),
      };
    }

    const result = await this.taskCommentModel.deleteMany(filter);

    this.logger.log(
      `${result.deletedCount} comments bulk deleted by user ${userId}`,
    );
    return result.deletedCount || 0;
  }
}
