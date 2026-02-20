import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SprintDocument = Sprint & Document;

export enum SprintStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

@Schema({ collection: 'sprints', timestamps: true })
export class Sprint {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop({
    type: String,
    enum: Object.values(SprintStatus),
    default: SprintStatus.PLANNING,
  })
  status: SprintStatus;

  @Prop()
  goal?: string;

  createdAt: Date;
}

export const SprintSchema = SchemaFactory.createForClass(Sprint);

// Indexes
// SprintSchema.index({ projectId: 1 });
// SprintSchema.index({ projectId: 1, status: 1 });
