import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationMemberDocument = ConversationMember & Document;

export type ConversationMemberRole = 'admin' | 'member';

@Schema({ collection: 'conversation_members', timestamps: true })
export class ConversationMember {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['admin', 'member'], default: 'member' })
  role: ConversationMemberRole;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ required: true })
  joinedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ConversationMemberSchema = SchemaFactory.createForClass(ConversationMember);

ConversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
ConversationMemberSchema.index({ userId: 1 });
ConversationMemberSchema.index({ conversationId: 1, role: 1 });
ConversationMemberSchema.index({ conversationId: 1, isBlocked: 1 });
