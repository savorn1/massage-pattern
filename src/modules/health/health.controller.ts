import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.health';
import { RabbitMQHealthIndicator } from './indicators/rabbitmq.health';
import { NatsHealthIndicator } from './indicators/nats.health';
import { BullMQHealthIndicator } from './indicators/bullmq.health';

/**
 * Health Controller
 *
 * Provides health check endpoints for monitoring:
 * - /health - Full health check (all services)
 * - /health/live - Liveness probe (is the app running?)
 * - /health/ready - Readiness probe (is the app ready to serve?)
 *
 * Checks:
 * - MongoDB connection
 * - Redis connection (Pub/Sub)
 * - RabbitMQ connection
 * - NATS connection
 * - BullMQ connection
 * - Memory usage
 * - Disk usage
 */
@Controller('health')
@SkipThrottle({ short: true, medium: true, long: true }) // Health checks should not be rate limited
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private mongoose: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisHealthIndicator,
    private rabbitmq: RabbitMQHealthIndicator,
    private nats: NatsHealthIndicator,
    private bullmq: BullMQHealthIndicator,
  ) {}

  /**
   * Full health check - checks all services
   * GET /health
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database
      () => this.mongoose.pingCheck('mongodb'),

      // Messaging services
      () => this.redis.isHealthy('redis'),
      () => this.rabbitmq.isHealthy('rabbitmq'),
      () => this.nats.isHealthy('nats'),

      // Queue services
      () => this.bullmq.isHealthy('bullmq'),

      // System resources
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024), // 500MB
    ]);
  }

  /**
   * Liveness probe - is the application running?
   * GET /health/live
   *
   * Used by Kubernetes/Docker to determine if the container should be restarted
   */
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([
      // Just check if the app is responding
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }

  /**
   * Readiness probe - is the application ready to serve traffic?
   * GET /health/ready
   *
   * Used by Kubernetes/Docker to determine if traffic should be routed to this instance
   */
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      // Check critical dependencies
      () => this.mongoose.pingCheck('mongodb'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  /**
   * Detailed status of all services
   * GET /health/services
   */
  @Get('services')
  async services() {
    const checks = await Promise.allSettled([
      this.mongoose.pingCheck('mongodb'),
      this.redis.isHealthy('redis'),
      this.rabbitmq.isHealthy('rabbitmq'),
      this.nats.isHealthy('nats'),
      this.bullmq.isHealthy('bullmq'),
    ]);

    const services = {
      mongodb: this.extractStatus(checks[0]),
      redis: this.extractStatus(checks[1]),
      rabbitmq: this.extractStatus(checks[2]),
      nats: this.extractStatus(checks[3]),
      bullmq: this.extractStatus(checks[4]),
    };

    const allHealthy = Object.values(services).every((s) => s.status === 'up');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    };
  }

  private extractStatus(result: PromiseSettledResult<unknown>): {
    status: string;
    message?: string;
  } {
    if (result.status === 'fulfilled') {
      return { status: 'up' };
    }
    return {
      status: 'down',
      message: (result.reason as Error)?.message || 'Unknown error',
    };
  }
}
