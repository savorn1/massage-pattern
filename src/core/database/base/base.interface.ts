import { Document } from 'mongoose';

/**
 * Base audit fields interface
 */
export interface IAuditFields {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Soft delete fields interface
 */
export interface ISoftDelete {
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

/**
 * Complete base entity interface combining audit and soft delete
 */
export interface IBaseEntity extends IAuditFields, ISoftDelete {}

/**
 * Base document with instance methods
 */
export interface IBaseDocument extends Document, IBaseEntity {
  /**
   * Soft delete this document
   */
  softDelete(userId?: string): Promise<this>;

  /**
   * Restore soft-deleted document
   */
  restore(): Promise<this>;
}

/**
 * Base model with static methods
 */
export interface IBaseModel<T extends IBaseDocument> {
  /**
   * Find all active (not deleted) documents
   */
  findActive(filter?: Record<string, unknown>): Promise<T[]>;

  /**
   * Find all deleted documents
   */
  findDeleted(filter?: Record<string, unknown>): Promise<T[]>;

  /**
   * Count active documents
   */
  countActive(filter?: Record<string, unknown>): Promise<number>;

  /**
   * Count deleted documents
   */
  countDeleted(filter?: Record<string, unknown>): Promise<number>;
}

/**
 * Pagination options interface
 */
export interface IPaginationOptions {
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

/**
 * Paginated result interface
 */
export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
  totalPages: number;
  currentPage: number;
}
