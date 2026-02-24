import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FundPoolExecutionDocument = FundPoolExecution & Document;

@Schema({ collection: 'fund_pool_executions', timestamps: false })
export class FundPoolExecution {
  @Prop({ type: Types.ObjectId, ref: 'FundPool', required: true })
  poolId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amountAdded: number;

  @Prop({ type: Number, required: true })
  balanceAfter: number;

  @Prop({ type: Date, required: true, default: () => new Date() })
  executedAt: Date;
}

export const FundPoolExecutionSchema = SchemaFactory.createForClass(FundPoolExecution);

// Compound index: fast queries for a pool's history sorted by time
FundPoolExecutionSchema.index({ poolId: 1, executedAt: -1 });
