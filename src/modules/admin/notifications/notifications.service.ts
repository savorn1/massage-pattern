import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from '@/modules/shared/entities';

export interface CreateNotificationDto {
  recipientId: string;
  actorId?: string;
  taskId?: string;
  taskTitle?: string;
  type: NotificationType;
  message: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly model: Model<NotificationDocument>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<NotificationDocument> {
    const doc = new this.model({
      recipientId: new Types.ObjectId(dto.recipientId),
      actorId: dto.actorId ? new Types.ObjectId(dto.actorId) : undefined,
      taskId: dto.taskId ? new Types.ObjectId(dto.taskId) : undefined,
      taskTitle: dto.taskTitle,
      type: dto.type,
      message: dto.message,
      isRead: false,
    });
    const saved = await doc.save();
    this.logger.debug(`Notification created for user ${dto.recipientId}: ${dto.message}`);
    return saved;
  }

  async findByUser(userId: string, limit = 30): Promise<NotificationDocument[]> {
    return this.model
      .find({ recipientId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.model.countDocuments({
      recipientId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.model.updateOne(
      { _id: new Types.ObjectId(id), recipientId: new Types.ObjectId(userId) },
      { $set: { isRead: true } },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.model.updateMany(
      { recipientId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } },
    );
  }
}
