import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FeatureFlagDocument = FeatureFlag & Document;

export type FlagType = 'boolean' | 'percentage' | 'users';

@Schema({ collection: 'feature_flags', timestamps: true })
export class FeatureFlag {
  /** Unique machine-readable key, e.g. "new-dashboard" */
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  key: string;

  /** Human-readable display name */
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  /** Is the flag currently enabled? */
  @Prop({ default: false })
  enabled: boolean;

  /**
   * boolean    — flag is simply on or off
   * percentage — enabled for a rolling percentage of users (0–100)
   * users      — enabled only for specific user IDs
   */
  @Prop({ type: String, enum: ['boolean', 'percentage', 'users'], default: 'boolean' })
  type: FlagType;

  /** Used when type === 'percentage' */
  @Prop({ type: Number, min: 0, max: 100, default: 100 })
  percentage: number;

  /** Used when type === 'users' */
  @Prop({ type: [String], default: [] })
  userIds: string[];

  /** Optional tag/category for grouping flags in the UI */
  @Prop({ default: 'general' })
  category: string;

  createdAt: Date;
  updatedAt: Date;
}

export const FeatureFlagSchema = SchemaFactory.createForClass(FeatureFlag);

// FeatureFlagSchema.index({ key: 1 }, { unique: true });
// FeatureFlagSchema.index({ category: 1 });
// FeatureFlagSchema.index({ enabled: 1 });
