import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { LoadTestService } from './load-test.service';
import { RedisPubsubModule } from '@/modules/messaging/redis-pubsub/redis-pubsub.module';
import { NatsPubSubModule } from '@/modules/messaging/nats-pubsub/nats-pubsub.module';
import { WebsocketModule } from '@/modules/messaging/websocket/websocket.module';

@Module({
  imports: [RedisPubsubModule, NatsPubSubModule, WebsocketModule],
  controllers: [EventsController],
  providers: [EventsService, LoadTestService],
  exports: [EventsService],
})
export class EventsModule {}
