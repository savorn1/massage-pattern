import { Model, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';
import {
  IBaseDocument,
  IPaginationOptions,
  IPaginatedResult,
} from './base.interface';

/**
 * Enhanced base repository with improved CRUD operations
 * Provides comprehensive query methods with better pagination and filtering
 */
export abstract class EnhancedBaseRepository<T extends IBaseDocument> {
  constructor(protected readonly model: Model<T>) {}

  /**
   * Create a new entity
   */
  async create(data: Partial<T>): Promise<T> {
    const entity = new this.model(data);
    return entity.save();
  }

  /**
   * Create multiple entities in bulk
   */
  async createMany(data: Partial<T>[]): Promise<T[]> {
    const result = await this.model.insertMany(data);
    return result as unknown as T[];
  }

  /**
   * Find entity by ID (only active by default)
   */
  async findById(
    id: string,
    options?: QueryOptions & { includeDeleted?: boolean },
  ): Promise<T | null> {
    const filter: FilterQuery<T> = { _id: id } as FilterQuery<T>;
    if (!options?.includeDeleted) {
      filter.isDeleted = false as never;
    }
    return this.model.findOne(filter, null, options).exec();
  }

  /**
   * Find one entity matching filter (active only by default)
   */
  async findOne(
    filter: FilterQuery<T>,
    options?: QueryOptions & { includeDeleted?: boolean },
  ): Promise<T | null> {
    const queryFilter = { ...filter };
    if (!options?.includeDeleted) {
      queryFilter.isDeleted = false as never;
    }
    return this.model.findOne(queryFilter, null, options).exec();
  }

  /**
   * Find all active entities
   */
  async findActive(
    filter: FilterQuery<T> = {},
    options?: QueryOptions,
  ): Promise<T[]> {
    return this.model
      .find({ ...filter, isDeleted: false } as FilterQuery<T>, null, options)
      .exec();
  }

  /**
   * Find all deleted entities
   */
  async findDeleted(
    filter: FilterQuery<T> = {},
    options?: QueryOptions,
  ): Promise<T[]> {
    return this.model
      .find({ ...filter, isDeleted: true } as FilterQuery<T>, null, options)
      .exec();
  }

  /**
   * Find all entities (including deleted if specified)
   */
  async findAll(
    filter: FilterQuery<T> = {},
    options?: QueryOptions & { includeDeleted?: boolean },
  ): Promise<T[]> {
    const queryFilter = { ...filter };
    if (!options?.includeDeleted) {
      queryFilter.isDeleted = false as never;
    }
    return this.model.find(queryFilter, null, options).exec();
  }

  /**
   * Enhanced pagination with metadata
   */
  async paginate(
    filter: FilterQuery<T> = {},
    pagination: IPaginationOptions = {},
    options?: { includeDeleted?: boolean },
  ): Promise<IPaginatedResult<T>> {
    const { skip = 0, limit = 10, sort = { createdAt: -1 } } = pagination;

    const queryFilter = { ...filter };
    if (!options?.includeDeleted) {
      queryFilter.isDeleted = false as never;
    }

    const query = this.model
      .find(queryFilter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const [data, total] = await Promise.all([
      query.exec(),
      this.model.countDocuments(queryFilter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(skip / limit) + 1;

    return {
      data,
      total,
      skip,
      limit,
      hasMore: skip + limit < total,
      totalPages,
      currentPage,
    };
  }

  /**
   * Update entity by ID
   */
  async update(
    id: string,
    data: UpdateQuery<T>,
    options?: QueryOptions,
  ): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(id, data, { new: true, ...options })
      .exec();
  }

  /**
   * Update one entity matching filter
   */
  async updateOne(
    filter: FilterQuery<T>,
    data: UpdateQuery<T>,
    options?: QueryOptions,
  ): Promise<T | null> {
    return this.model
      .findOneAndUpdate(filter, data, { new: true, ...options })
      .exec();
  }

  /**
   * Update multiple entities
   */
  async updateMany(
    filter: FilterQuery<T>,
    data: UpdateQuery<T>,
  ): Promise<number> {
    const result = await this.model.updateMany(filter, data).exec();
    return result.modifiedCount;
  }

  /**
   * Hard delete entity by ID (permanent removal)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return !!result;
  }

  /**
   * Soft delete entity by ID
   */
  async softDelete(id: string, userId?: string): Promise<T | null> {
    const entity = await this.model.findById(id).exec();
    if (!entity) return null;
    return entity.softDelete(userId);
  }

  /**
   * Soft delete multiple entities
   */
  async softDeleteMany(
    filter: FilterQuery<T>,
    userId?: string,
  ): Promise<number> {
    const result = await this.model
      .updateMany(filter, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      } as UpdateQuery<T>)
      .exec();
    return result.modifiedCount;
  }

  /**
   * Restore soft-deleted entity
   */
  async restore(id: string): Promise<T | null> {
    const entity = await this.model.findById(id).exec();
    if (!entity) return null;
    return entity.restore();
  }

  /**
   * Restore multiple soft-deleted entities
   */
  async restoreMany(filter: FilterQuery<T>): Promise<number> {
    const result = await this.model
      .updateMany(
        { ...filter, isDeleted: true } as FilterQuery<T>,
        {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        } as UpdateQuery<T>,
      )
      .exec();
    return result.modifiedCount;
  }

  /**
   * Count all entities (active by default)
   */
  async count(
    filter: FilterQuery<T> = {},
    includeDeleted = false,
  ): Promise<number> {
    const queryFilter = { ...filter };
    if (!includeDeleted) {
      queryFilter.isDeleted = false as never;
    }
    return this.model.countDocuments(queryFilter).exec();
  }

  /**
   * Count active entities
   */
  async countActive(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model
      .countDocuments({ ...filter, isDeleted: false } as FilterQuery<T>)
      .exec();
  }

  /**
   * Count deleted entities
   */
  async countDeleted(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model
      .countDocuments({ ...filter, isDeleted: true } as FilterQuery<T>)
      .exec();
  }

  /**
   * Check if entity exists (active by default)
   */
  async exists(
    filter: FilterQuery<T>,
    includeDeleted = false,
  ): Promise<boolean> {
    const queryFilter = { ...filter };
    if (!includeDeleted) {
      queryFilter.isDeleted = false as never;
    }
    const count = await this.model.countDocuments(queryFilter).limit(1).exec();
    return count > 0;
  }

  /**
   * Find entities created within date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    filter: FilterQuery<T> = {},
  ): Promise<T[]> {
    return this.model
      .find({
        ...filter,
        isDeleted: false,
        createdAt: { $gte: startDate, $lte: endDate },
      } as FilterQuery<T>)
      .exec();
  }

  /**
   * Find entities updated within date range
   */
  async findUpdatedInRange(
    startDate: Date,
    endDate: Date,
    filter: FilterQuery<T> = {},
  ): Promise<T[]> {
    return this.model
      .find({
        ...filter,
        isDeleted: false,
        updatedAt: { $gte: startDate, $lte: endDate },
      } as FilterQuery<T>)
      .exec();
  }

  /**
   * Find recently created entities
   */
  async findRecent(limit = 10, filter: FilterQuery<T> = {}): Promise<T[]> {
    return this.model
      .find({ ...filter, isDeleted: false } as FilterQuery<T>)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Search entities with text search (requires text index)
   */
  async search(
    searchTerm: string,
    filter: FilterQuery<T> = {},
    limit = 10,
  ): Promise<T[]> {
    return this.model
      .find({
        ...filter,
        isDeleted: false,
        $text: { $search: searchTerm },
      } as FilterQuery<T>)
      .sort({ score: { $meta: 'textScore' } } as never)
      .limit(limit)
      .exec();
  }
}
