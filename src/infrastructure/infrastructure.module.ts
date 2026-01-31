import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';

/**
 * Infrastructure Module
 *
 * Contains only database/external service CONNECTION setup:
 * - MongoDB connection (via DatabaseModule)
 *
 * Note: Feature modules (messaging, workers, etc.) are imported
 * directly in app.module.ts for better clarity
 */
@Module({
  imports: [DatabaseModule],
  exports: [DatabaseModule],
})
export class InfrastructureModule {}
