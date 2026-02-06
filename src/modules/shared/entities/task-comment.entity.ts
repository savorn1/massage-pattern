import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskCommentDocument = TaskComment & Document;

@Schema({ collection: 'task_comments', timestamps: true })
export class TaskComment {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  createdAt: Date;
  updatedAt: Date;
}

export const TaskCommentSchema = SchemaFactory.createForClass(TaskComment);

// Indexes
TaskCommentSchema.index({ taskId: 1 });
TaskCommentSchema.index({ taskId: 1, createdAt: -1 });
