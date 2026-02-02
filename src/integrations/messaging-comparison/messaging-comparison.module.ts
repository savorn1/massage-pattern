import { Module } from '@nestjs/common';
import { MessagingComparisonController } from './messaging-comparison.controller';
import { MessagingComparisonService } from './messaging-comparison.service';
import { UseCaseExamplesController } from './use-case-examples.controller';
import { UseCaseExamplesService } from './use-case-examples.service';
import { RedisPubsubModule } from '../../modules/messaging/redis-pubsub/redis-pubsub.module';
import { RedisStreamsModule } from '../../modules/messaging/redis-streams/redis-streams.module';
import { RabbitmqModule } from '../../modules/messaging/rabbitmq/rabbitmq.module';
import { BullmqModule } from '../../modules/workers/bullmq/bullmq.module';

@Module({
  imports: [
    RedisPubsubModule,
    RedisStreamsModule,
    RabbitmqModule,
    BullmqModule,
  ],
  controllers: [MessagingComparisonController, UseCaseExamplesController],
  providers: [MessagingComparisonService, UseCaseExamplesService],
  exports: [MessagingComparisonService, UseCaseExamplesService],
})
export class MessagingComparisonModule {}
