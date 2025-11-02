import { Prop } from '@nestjs/mongoose';

/**
 * Base entity with common fields for all entities
 * Provides audit trail and soft delete functionality
 */
export abstract class BaseEntity {
  /**
   * Creation timestamp
   */
  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  /**
   * User ID who created this entity
   */
  @Prop({ type: String })
  createdBy?: string;

  /**
   * User ID who last updated this entity
   */
  @Prop({ type: String })
  updatedBy?: string;

  /**
   * Soft delete flag
   */
  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  /**
   * Soft delete timestamp
   */
  @Prop({ type: Date })
  deletedAt?: Date;

  /**
   * User ID who deleted this entity
   */
  @Prop({ type: String })
  deletedBy?: string;
}
