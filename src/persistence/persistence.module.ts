import { Module } from '@nestjs/common';

// Persistence modules
import { MongodbModule } from './mongodb/mongodb.module';

/**
 * Persistence Module
 *
 * Groups all data persistence modules:
 * - MongoDB - Document storage, message history, CRUD operations
 *
 * Note: Database CONNECTION is handled by infrastructure/database
 *       This module handles data OPERATIONS (CRUD, queries, etc.)
 *
 * Future additions:
 * - Redis Cache Module
 * - Elasticsearch Module
 * - File Storage Module
 */
@Module({
  imports: [MongodbModule],
  exports: [MongodbModule],
})
export class PersistenceModule {}
