/**
 * Base database utilities barrel export
 * Provides all necessary components for entity management
 */

// Base entity class
export { BaseEntity } from './base.entity';

// Base repository (original)
export { BaseRepository } from './base.repository';

// Enhanced repository with advanced features
export { EnhancedBaseRepository } from './enhanced-base.repository';

// Base entity plugin for Mongoose schemas
export { baseEntityPlugin } from './base-entity.plugin';

// Interfaces for type safety
export {
  IAuditFields,
  ISoftDelete,
  IBaseEntity,
  IBaseDocument,
  IBaseModel,
  IPaginationOptions,
  IPaginatedResult,
} from './base.interface';
