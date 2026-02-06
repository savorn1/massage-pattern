import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskActivityDocument = TaskActivity & Document;

export enum TaskActivityAction {
  CREATED = 'created',
  STATUS_CHANGED = 'status_changed',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  PRIORITY_CHANGED = 'priority_changed',
  DUE_DATE_CHANGED = 'due_date_changed',
  SPRINT_CHANGED = 'sprint_changed',
  LABEL_ADDED = 'label_added',
  LABEL_REMOVED = 'label_removed',
  COMMENT_ADDED = 'comment_added',
  FILE_ATTACHED = 'file_attached',
  FILE_REMOVED = 'file_removed',
  TITLE_CHANGED = 'title_changed',
  DESCRIPTION_CHANGED = 'description_changed',
}

@Schema({ collection: 'task_activities', timestamps: false })
export class TaskActivity {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(TaskActivityAction),
    required: true,
  })
  action: TaskActivityAction;

  @Prop({ type: Object })
  meta?: Record<string, unknown>;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const TaskActivitySchema = SchemaFactory.createForClass(TaskActivity);

// Indexes
TaskActivitySchema.index({ taskId: 1 });
TaskActivitySchema.index({ taskId: 1, createdAt: -1 });
TaskActivitySchema.index({ userId: 1 });
