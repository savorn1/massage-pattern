import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseEntity } from '@/core/database/base/base.entity';

export type MilestoneDocument = Milestone & Document;

export enum MilestoneStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
}

/**
 * Milestone entity for project milestones
 */
@Schema({ collection: 'milestones', timestamps: true })
export class Milestone extends BaseEntity {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(MilestoneStatus),
    default: MilestoneStatus.PENDING,
  })
  status: MilestoneStatus;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progress: number;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const MilestoneSchema = SchemaFactory.createForClass(Milestone);
