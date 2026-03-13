import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SavedReplyDocument = SavedReply & Document;

@Schema({ collection: 'saved_replies', timestamps: true })
export class SavedReply {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  /** Display name, e.g. "Daily Standup" */
  @Prop({ required: true })
  title: string;

  /** Slash-command trigger, e.g. "standup" → typed as /standup */
  @Prop({ required: true })
  shortcut: string;

  /** The full message content that gets inserted */
  @Prop({ required: true })
  content: string;

  createdAt: Date;
  updatedAt: Date;
}

export const SavedReplySchema = SchemaFactory.createForClass(SavedReply);

SavedReplySchema.index({ userId: 1 });
// Unique shortcut per user
SavedReplySchema.index({ userId: 1, shortcut: 1 }, { unique: true });
