import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

// Health indicators
import {
  RedisHealthIndicator,
  RabbitMQHealthIndicator,
  NatsHealthIndicator,
  BullMQHealthIndicator,
} from './indicators';

// Import modules to access their services
import { RedisPubsubModule } from '../messaging/redis-pubsub/redis-pubsub.module';
import { RabbitmqModule } from '../messaging/rabbitmq/rabbitmq.module';
import { NatsRpcModule } from '../messaging/nats-rpc/nats-rpc.module';
import { BullmqModule } from '../../workers/bullmq/bullmq.module';

/**
 * Health Module
 *
 * Provides comprehensive health checks for all services:
 * - MongoDB (via Terminus MongooseHealthIndicator)
 * - Redis (custom indicator)
 * - RabbitMQ (custom indicator)
 * - NATS (custom indicator)
 * - BullMQ (custom indicator)
 * - Memory (via Terminus MemoryHealthIndicator)
 *
 * Endpoints:
 * - GET /health - Full health check
 * - GET /health/live - Liveness probe
 * - GET /health/ready - Readiness probe
 * - GET /health/services - Detailed service status
 */
@Module({
  imports: [
    TerminusModule,
    RedisPubsubModule,
    RabbitmqModule,
    NatsRpcModule,
    BullmqModule,
  ],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    RabbitMQHealthIndicator,
    NatsHealthIndicator,
    BullMQHealthIndicator,
  ],
})
export class HealthModule {}
