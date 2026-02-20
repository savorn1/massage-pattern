import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProjectDocument = Project & Document;

export enum ProjectStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Schema({ collection: 'projects', timestamps: true })
export class Project {
  @Prop({ type: Types.ObjectId, ref: 'Workplace', required: true })
  workplaceId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, uppercase: true, trim: true })
  key: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ProjectStatus),
    default: ProjectStatus.ACTIVE,
  })
  status: ProjectStatus;

  @Prop({
    type: String,
    enum: Object.values(ProjectPriority),
    default: ProjectPriority.MEDIUM,
  })
  priority: ProjectPriority;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// Indexes
// ProjectSchema.index({ workplaceId: 1 });
// ProjectSchema.index({ workplaceId: 1, key: 1 }, { unique: true });
// ProjectSchema.index({ ownerId: 1 });
// ProjectSchema.index({ status: 1 });
