import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
  POLL = 'poll',
  VOICE = 'voice',
  AI_RESPONSE = 'ai_response',
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

  /** Telegram-like setting: allow selecting multiple answers */
  @Prop({ type: Boolean, default: false })
  allowMultiple: boolean;

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

export class MessageEditHistoryEntry {
  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  editedAt: Date;
}

export class ForwardedFrom {
  @Prop({ type: Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ required: true })
  senderName: string;
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

  /** Edit history — previous versions of the message content */
  @Prop({ type: [Object], default: [] })
  editHistory: MessageEditHistoryEntry[];

  /** Forwarded-from metadata — set when this message is a forward */
  @Prop({ type: Object })
  forwardedFrom?: ForwardedFrom;

  /** Mentioned user IDs parsed from @[name](userId) patterns */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  mentions: Types.ObjectId[];

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
MessageSchema.index({ mentions: 1 }, { sparse: true });


