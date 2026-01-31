import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { NatsRpcService } from '../../messaging/nats-rpc/nats-rpc.service';

@Injectable()
export class NatsHealthIndicator extends HealthIndicator {
  constructor(private readonly natsService: NatsRpcService) {
    super();
  }

  isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isConnected = this.natsService.isConnected();

    const result = this.getStatus(key, isConnected, {
      status: isConnected ? 'connected' : 'disconnected',
    });

    if (isConnected) {
      return Promise.resolve(result);
    }

    return Promise.reject(new HealthCheckError('NATS check failed', result));
  }
}
