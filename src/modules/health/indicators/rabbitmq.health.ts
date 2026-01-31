import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RabbitmqService } from '../../messaging/rabbitmq/rabbitmq.service';

@Injectable()
export class RabbitMQHealthIndicator extends HealthIndicator {
  constructor(private readonly rabbitmqService: RabbitmqService) {
    super();
  }

  isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isConnected = this.rabbitmqService.isConnected();

    const result = this.getStatus(key, isConnected, {
      status: isConnected ? 'connected' : 'disconnected',
    });

    if (isConnected) {
      return Promise.resolve(result);
    }

    return Promise.reject(
      new HealthCheckError('RabbitMQ check failed', result),
    );
  }
}
