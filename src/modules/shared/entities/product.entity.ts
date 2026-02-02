import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '@/core/database/base/base.entity';

export type ProductDocument = Product & Document;

/**
 * Product entity for vendor products
 * Extends BaseEntity for audit trail and soft delete functionality
 */
@Schema({ collection: 'products', timestamps: true })
export class Product extends BaseEntity {
  @Prop({ required: true })
  vendorId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  stock: number;

  @Prop()
  category: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
