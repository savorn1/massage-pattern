import { Model, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';
import { PaginationParams } from '../../interfaces/pagination.interface';

/**
 * Base repository with common CRUD operations
 * Extend this class to create specific repositories
 */
export abstract class BaseRepository<T> {
  constructor(protected readonly model: Model<T>) {}

  /**
   * Create a new entity
   */
  create(data: Partial<T>): Promise<T> {
    const entity = new this.model(data);
    return entity.save() as unknown as Promise<T>;
  }

  /**
   * Find entity by ID
   */
  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    return this.model.findById(id, null, options).exec();
  }

  /**
   * Find one entity matching filter
   */
  async findOne(
    filter: FilterQuery<T>,
    options?: QueryOptions,
  ): Promise<T | null> {
    return this.model.findOne(filter, null, options).exec();
  }

  /**
   * Find all entities matching filter
   */
  async findAll(
    filter: FilterQuery<T> = {},
    pagination?: PaginationParams,
    options?: QueryOptions,
  ): Promise<T[]> {
    const query = this.model.find(filter, null, options);

    if (pagination) {
      if (pagination.skip !== undefined) {
        query.skip(pagination.skip);
      }
      if (pagination.limit !== undefined) {
        query.limit(pagination.limit);
      }
    }

    return query.exec();
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
      .findByIdAndUpdate(
        id,
        { ...data, updatedAt: new Date() },
        { new: true, ...options },
      )
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
      .findOneAndUpdate(
        filter,
        { ...data, updatedAt: new Date() },
        { new: true, ...options },
      )
      .exec();
  }

  /**
   * Hard delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return !!result;
  }

  /**
   * Soft delete entity by ID
   */
  async softDelete(id: string, userId?: string): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedAt: new Date(),
        } as UpdateQuery<T>,
        { new: true },
      )
      .exec();
  }

  /**
   * Restore soft-deleted entity
   */
  async restore(id: string): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(
        id,
        {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedAt: new Date(),
        } as UpdateQuery<T>,
        { new: true },
      )
      .exec();
  }

  /**
   * Count entities matching filter
   */
  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  /**
   * Check if entity exists
   */
  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const count = await this.model.countDocuments(filter).limit(1).exec();
    return count > 0;
  }

  /**
   * Find with pagination and sorting
   */
  async findWithPagination(
    filter: FilterQuery<T> = {},
    pagination: PaginationParams,
    sort?: Record<string, 1 | -1>,
  ): Promise<{ data: T[]; total: number }> {
    const { skip = 0, limit = 10 } = pagination;

    const query = this.model.find(filter);

    if (sort) {
      query.sort(sort);
    }

    query.skip(skip).limit(limit);

    const [data, total] = await Promise.all([query.exec(), this.count(filter)]);

    return { data, total };
  }
}
