import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserConversationDocument = UserConversation & Document;

@Schema({ collection: 'user_conversations', timestamps: true })
export class UserConversation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  // The last message the user has read in this conversation
  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastReadMessageId?: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  unreadCount: number;

  @Prop({ required: true })
  joinedAt: Date;

  @Prop({ default: false })
  muted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const UserConversationSchema =
  SchemaFactory.createForClass(UserConversation);

// One record per user per conversation
UserConversationSchema.index({ userId: 1, conversationId: 1 }, { unique: true });
// Fetch all conversations for a user ordered by activity
UserConversationSchema.index({ userId: 1 });
