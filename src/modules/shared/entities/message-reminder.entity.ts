import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageReminderDocument = MessageReminder & Document;

export enum MessageReminderStatus {
  PENDING   = 'pending',
  SENT      = 'sent',
  CANCELLED = 'cancelled',
}

@Schema({ collection: 'message_reminders', timestamps: true })
export class MessageReminder {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  /** When to fire the reminder */
  @Prop({ required: true })
  remindAt: Date;

  /** Optional personal note added by the user */
  @Prop()
  note?: string;

  /** Snapshot of message content at reminder creation time */
  @Prop()
  messageContent?: string;

  @Prop({
    type: String,
    enum: Object.values(MessageReminderStatus),
    default: MessageReminderStatus.PENDING,
  })
  status: MessageReminderStatus;

  /** BullMQ job ID — used to cancel before firing */
  @Prop()
  jobId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const MessageReminderSchema = SchemaFactory.createForClass(MessageReminder);

MessageReminderSchema.index({ userId: 1, status: 1 });
MessageReminderSchema.index({ remindAt: 1, status: 1 });
