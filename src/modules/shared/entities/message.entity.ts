import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
  POLL = 'poll',
}

export class PollOption {
  @Prop({ required: true })
  text: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  votes: Types.ObjectId[];
}

export class Poll {
  @Prop({ required: true })
  question: string;

  @Prop({ type: [Object], default: [] })
  options: PollOption[];
}

export class MessageAttachment {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop()
  size?: number;
}

export class MessageReadReceipt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  readAt: Date;
}

export class MessageDeliveryReceipt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  deliveredAt: Date;
}

export class MessageReaction {
  @Prop({ required: true })
  emoji: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
}

@Schema({ collection: 'messages', timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Prop({ default: '' })
  content: string;

  @Prop({ type: [Object], default: [] })
  attachments: MessageAttachment[];

  // Reference to the message this is replying to (thread support)
  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo?: Types.ObjectId;

  @Prop({ type: [Object], default: [] })
  readBy: MessageReadReceipt[];

  @Prop({ type: [Object], default: [] })
  deliveredTo: MessageDeliveryReceipt[];

  @Prop({ type: [Object], default: [] })
  reactions: MessageReaction[];

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop()
  editedAt?: Date;

  /** Set when the conversation has disappearing messages enabled */
  @Prop()
  expiresAt?: Date;

  /** Poll payload — only present when type === 'poll' */
  @Prop({ type: Object })
  poll?: Poll;

  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes for efficient queries
MessageSchema.index({ conversationId: 1, createdAt: -1 });
// TTL index — MongoDB auto-deletes messages when expiresAt is in the past
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });
MessageSchema.index({ conversationId: 1, isDeleted: 1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ 'readBy.userId': 1 });

