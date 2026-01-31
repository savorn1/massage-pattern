import { Module } from '@nestjs/common';

// Messaging Modules
import { RedisPubsubModule } from '../messaging/redis-pubsub/redis-pubsub.module';
import { RedisStreamsModule } from '../messaging/redis-streams/redis-streams.module';
import { RabbitmqModule } from '../messaging/rabbitmq/rabbitmq.module';
import { NatsRpcModule } from '../messaging/nats-rpc/nats-rpc.module';
import { WebsocketModule } from '../messaging/websocket/websocket.module';

// Database Modules
import { MongodbModule } from '../persistence/mongodb/mongodb.module';

// Queue Modules
import { BullmqModule } from '../workers/bullmq/bullmq.module';

/**
 * Infrastructure Module
 *
 * Groups all external service integrations:
 * - Messaging (Pub/Sub, Streams, RabbitMQ, NATS, WebSocket)
 * - Database (MongoDB)
 * - Queue (BullMQ)
 *
 * This module provides a clean separation between business logic
 * and infrastructure concerns.
 */
@Module({
  imports: [
    // ════════════════════════════════════════════════════════════════════════
    // MESSAGING SERVICES
    // ════════════════════════════════════════════════════════════════════════

    // Redis Pub/Sub - Real-time broadcasts, cache invalidation
    RedisPubsubModule,

    // Redis Streams - Event sourcing, audit logs, message history
    RedisStreamsModule,

    // RabbitMQ - Reliable job queues, complex routing
    RabbitmqModule,

    // NATS - Microservices RPC, request/response
    NatsRpcModule,

    // WebSocket - Real-time bidirectional communication
    WebsocketModule,

    // ════════════════════════════════════════════════════════════════════════
    // DATABASE SERVICES
    // ════════════════════════════════════════════════════════════════════════

    // MongoDB - Document storage, message persistence
    MongodbModule,

    // ════════════════════════════════════════════════════════════════════════
    // QUEUE SERVICES
    // ════════════════════════════════════════════════════════════════════════

    // BullMQ - Background jobs, scheduled tasks, retries
    BullmqModule,
  ],
  exports: [
    // Export all modules for use in other parts of the application
    RedisPubsubModule,
    RedisStreamsModule,
    RabbitmqModule,
    NatsRpcModule,
    WebsocketModule,
    MongodbModule,
    BullmqModule,
  ],
})
export class InfrastructureModule {}
