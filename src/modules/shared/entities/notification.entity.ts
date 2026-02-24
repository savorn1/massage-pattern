import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  MENTIONED       = 'mentioned',
  ASSIGNED        = 'assigned',
  TASK_COMPLETED  = 'task_completed',
}

@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  taskId?: Types.ObjectId;

  @Prop()
  taskTitle?: string;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  isRead: boolean;

  createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
