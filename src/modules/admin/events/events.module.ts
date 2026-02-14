import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { RedisPubsubModule } from '@/modules/messaging/redis-pubsub/redis-pubsub.module';
import { WebsocketModule } from '@/modules/messaging/websocket/websocket.module';

@Module({
  imports: [RedisPubsubModule, WebsocketModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
