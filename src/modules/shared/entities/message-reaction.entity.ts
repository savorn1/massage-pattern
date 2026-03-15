import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageReactionDocument = MessageReaction & Document;

@Schema({ collection: 'message_reactions', timestamps: true })
export class MessageReaction {
  @Prop({ type: Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  emoji: string;

  createdAt: Date;
  updatedAt: Date;
}

export const MessageReactionSchema = SchemaFactory.createForClass(MessageReaction);

MessageReactionSchema.index({ messageId: 1, emoji: 1 });
MessageReactionSchema.index({ messageId: 1, userId: 1, emoji: 1 }, { unique: true });
