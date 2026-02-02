import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '@/core/database/base/base.entity';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

/**
 * Order entity for client orders
 * Extends BaseEntity for audit trail and soft delete functionality
 */
@Schema({ collection: 'orders', timestamps: true })
export class Order extends BaseEntity {
  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  vendorId: string;

  @Prop({ type: [Object], required: true })
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop()
  shippingAddress: string;

  @Prop()
  paymentMethod: string;

  @Prop()
  notes?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
