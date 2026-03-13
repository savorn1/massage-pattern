import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MessageType } from './message.entity';

export type ScheduledMessageDocument = ScheduledMessage & Document;

export enum ScheduledMessageStatus {
  PENDING   = 'pending',
  SENT      = 'sent',
  CANCELLED = 'cancelled',
  FAILED    = 'failed',
}

@Schema({ collection: 'scheduled_messages', timestamps: true })
export class ScheduledMessage {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ default: '' })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo?: Types.ObjectId;

  /** When the message should be sent */
  @Prop({ required: true })
  scheduledFor: Date;

  @Prop({
    type: String,
    enum: Object.values(ScheduledMessageStatus),
    default: ScheduledMessageStatus.PENDING,
  })
  status: ScheduledMessageStatus;

  /** BullMQ job ID — used to cancel before delivery */
  @Prop()
  jobId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ScheduledMessageSchema = SchemaFactory.createForClass(ScheduledMessage);

ScheduledMessageSchema.index({ senderId: 1, status: 1 });
ScheduledMessageSchema.index({ scheduledFor: 1, status: 1 });
