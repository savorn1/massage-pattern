import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkplaceDocument = Workplace & Document;

export enum WorkplacePlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum WorkplaceStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

@Schema({ collection: 'workplaces', timestamps: true })
export class Workplace {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(WorkplacePlan),
    default: WorkplacePlan.FREE,
  })
  plan: WorkplacePlan;

  @Prop({
    type: String,
    enum: Object.values(WorkplaceStatus),
    default: WorkplaceStatus.ACTIVE,
  })
  status: WorkplaceStatus;

  createdAt: Date;
  updatedAt: Date;
}

export const WorkplaceSchema = SchemaFactory.createForClass(Workplace);

// Indexes
WorkplaceSchema.index({ slug: 1 }, { unique: true });
WorkplaceSchema.index({ ownerId: 1 });
WorkplaceSchema.index({ status: 1 });
