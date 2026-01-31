import { Module } from '@nestjs/common';

// Integration modules
import { ExamplesModule } from './examples/examples.module';
import { TaskSystemModule } from './task-system/task-system.module';
import { FinalProjectModule } from './final-project/final-project.module';
import { MessagingComparisonModule } from './messaging-comparison/messaging-comparison.module';

/**
 * Integrations Module
 *
 * Groups all example and integration modules:
 * - Examples - Basic usage examples
 * - TaskSystem - Task management examples
 * - FinalProject - Combined patterns example
 * - MessagingComparison - Pattern comparison tools
 */
@Module({
  imports: [
    ExamplesModule,
    TaskSystemModule,
    FinalProjectModule,
    MessagingComparisonModule,
  ],
  exports: [
    ExamplesModule,
    TaskSystemModule,
    FinalProjectModule,
    MessagingComparisonModule,
  ],
})
export class IntegrationsModule {}
