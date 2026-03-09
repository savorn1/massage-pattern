import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

export enum ConversationType {
  PRIVATE = 'private',
  GROUP = 'group',
}

export class PinnedMessage {
  @Prop({ type: Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  pinnedBy: Types.ObjectId;

  @Prop({ required: true })
  pinnedAt: Date;

  @Prop()
  content?: string;
}

export class LastMessageSnapshot {
  @Prop({ type: Types.ObjectId })
  messageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  senderId: Types.ObjectId;

  @Prop()
  content: string;

  @Prop()
  createdAt: Date;
}

export class DisappearingMessages {
  @Prop({ default: false })
  enabled: boolean;

  /** TTL in seconds — 3600 (1h) | 86400 (24h) | 604800 (7d) */
  @Prop({ default: 86400 })
  ttl: number;
}

@Schema({ collection: 'conversations', timestamps: true })
export class Conversation {
  @Prop({
    type: String,
    enum: Object.values(ConversationType),
    required: true,
  })
  type: ConversationType;

  // Both private & group
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  participants: Types.ObjectId[];

  // Group only
  @Prop()
  name?: string;

  @Prop()
  avatar?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  admins: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  blockedMembers: Types.ObjectId[];

  @Prop({ type: Object })
  lastMessage?: LastMessageSnapshot;

  @Prop({ type: [Object], default: [] })
  pinnedMessages: PinnedMessage[];

  @Prop({ type: Object })
  disappearingMessages?: DisappearingMessages;

  createdAt: Date;
  updatedAt: Date;
}


export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes for efficient queries
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ type: 1, participants: 1 });
// Unique index to prevent duplicate private conversations between two users
ConversationSchema.index(
  { type: 1, participants: 1 },
  { unique: false }, // handled at service level for private chats
);
