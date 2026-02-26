import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '@/core/database/base/base.entity';

export type PaymentQrDocument = PaymentQr & Document;

export enum PaymentQrStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Payment QR code record
 * Tracks every generated QR, its signed payload, and final payment result.
 */
@Schema({ collection: 'payment_qrs', timestamps: true })
export class PaymentQr extends BaseEntity {
  /** Stable public identifier embedded in the QR payload */
  @Prop({ required: true, unique: true, index: true })
  qrId: string;

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, default: 'USD' })
  currency: string;

  /** Random nonce — guarantees each QR is unique and single-use */
  @Prop({ required: true, unique: true, index: true })
  nonce: string;

  /** HMAC-SHA256 hex signature of the canonical payload */
  @Prop({ required: true })
  signature: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({
    type: String,
    enum: PaymentQrStatus,
    default: PaymentQrStatus.PENDING,
  })
  status: PaymentQrStatus;

  /** ISO timestamp of successful payment confirmation */
  @Prop()
  paidAt?: Date;

  /** BullMQ job ID for the payment processing job */
  @Prop()
  processingJobId?: string;
}

export const PaymentQrSchema = SchemaFactory.createForClass(PaymentQr);
