import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { BullmqService } from '../../../workers/bullmq/bullmq.service';

@Injectable()
export class BullMQHealthIndicator extends HealthIndicator {
  constructor(private readonly bullmqService: BullmqService) {
    super();
  }

  isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isConnected = this.bullmqService.isConnected();

    const result = this.getStatus(key, isConnected, {
      status: isConnected ? 'connected' : 'disconnected',
    });

    if (isConnected) {
      return Promise.resolve(result);
    }

    return Promise.reject(new HealthCheckError('BullMQ check failed', result));
  }
}
