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

// Apply base entity plugin for automatic timestamp and soft delete management
import { baseEntityPlugin } from '@/core/database/base/base-entity.plugin';
ProductSchema.plugin(baseEntityPlugin);

// Add performance indexes
ProductSchema.index({ vendorId: 1, createdAt: -1 }); // Vendor's products sorted by date
ProductSchema.index({ category: 1, isAvailable: 1 }); // Filter by category and availability
ProductSchema.index({ isAvailable: 1, isDeleted: 1 }); // Active products
ProductSchema.index({ isDeleted: 1 }); // Soft delete queries
ProductSchema.index({ vendorId: 1, isAvailable: 1, isDeleted: 1 }); // Vendor's active products
ProductSchema.index({ price: 1 }); // Sort by price
ProductSchema.index({ stock: 1 }); // Check stock levels
ProductSchema.index({ name: 'text', description: 'text' }); // Full-text search on name and description
