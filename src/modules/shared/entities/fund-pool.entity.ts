import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FundPoolDocument = FundPool & Document;

export enum FundPoolType {
  SAVINGS = 'savings',
  EMERGENCY = 'emergency',
  INVESTMENT = 'investment',
  OPERATIONAL = 'operational',
  RESERVE = 'reserve',
  GENERAL = 'general',
}

@Schema({ collection: 'fund_pools', timestamps: true })
export class FundPool {
  @Prop({ type: String, enum: FundPoolType, required: true })
  type: FundPoolType;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Number, required: true, default: 0 })
  currentAmount: number;

  @Prop({ type: Number, required: true, default: 0 })
  recurringAmount: number;

  @Prop({ type: Number, required: true, default: 60 })
  intervalMinutes: number;

  @Prop({ type: Boolean, required: true, default: true })
  isEnabled: boolean;

  @Prop({ type: Date, default: null })
  lastExecutedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const FundPoolSchema = SchemaFactory.createForClass(FundPool);
