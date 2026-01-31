import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisPubsubService } from '../../messaging/redis-pubsub/redis-pubsub.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisPubsubService) {
    super();
  }

  isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isConnected = this.redisService.isConnected();

    const result = this.getStatus(key, isConnected, {
      status: isConnected ? 'connected' : 'disconnected',
    });

    if (isConnected) {
      return Promise.resolve(result);
    }

    return Promise.reject(new HealthCheckError('Redis check failed', result));
  }
}
