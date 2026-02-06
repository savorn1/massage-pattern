import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskDocument = Task & Document;

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  DONE = 'done',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TaskType {
  TASK = 'task',
  BUG = 'bug',
  STORY = 'story',
  EPIC = 'epic',
}

@Schema({ collection: 'tasks', timestamps: true })
export class Task {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Sprint' })
  sprintId?: Types.ObjectId;

  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(TaskType),
    default: TaskType.TASK,
  })
  type: TaskType;

  @Prop({
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Prop({
    type: String,
    enum: Object.values(TaskPriority),
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assigneeId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reporterId?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Label' }], default: [] })
  labelIds: Types.ObjectId[];

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ type: Number, default: 0 })
  storyPoints?: number;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  parentId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Indexes
TaskSchema.index({ projectId: 1 });
TaskSchema.index({ projectId: 1, key: 1 }, { unique: true });
TaskSchema.index({ sprintId: 1 });
TaskSchema.index({ assigneeId: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ projectId: 1, status: 1 });
