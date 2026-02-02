import { Module } from '@nestjs/common';

// Worker modules
import { BullmqModule } from './bullmq/bullmq.module';

/**
 * Workers Module
 *
 * Groups all background job processing modules:
 * - BullMQ - Redis-based job queue with workers
 */
@Module({
  imports: [BullmqModule],
  exports: [BullmqModule],
})
export class WorkersModule {}
