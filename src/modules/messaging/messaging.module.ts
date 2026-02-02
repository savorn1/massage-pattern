import { Module } from '@nestjs/common';

// Messaging pattern modules
import { WebsocketModule } from './websocket/websocket.module';
import { RedisPubsubModule } from './redis-pubsub/redis-pubsub.module';
import { RedisStreamsModule } from './redis-streams/redis-streams.module';
import { NatsRpcModule } from './nats-rpc/nats-rpc.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { PusherModule } from './pusher/pusher.module';

/**
 * Messaging Module
 *
 * Groups all messaging pattern implementations:
 * - WebSocket (Socket.IO) - Real-time bidirectional
 * - Redis Pub/Sub - Broadcast messaging
 * - Redis Streams - Persistent event log
 * - NATS - Request/Response RPC
 * - RabbitMQ - Reliable job queues
 * - Pusher - Hosted real-time service
 */
@Module({
  imports: [
    WebsocketModule,
    RedisPubsubModule,
    RedisStreamsModule,
    NatsRpcModule,
    RabbitmqModule,
    PusherModule,
  ],
  exports: [
    WebsocketModule,
    RedisPubsubModule,
    RedisStreamsModule,
    NatsRpcModule,
    RabbitmqModule,
    PusherModule,
  ],
})
export class MessagingModule {}
