import { Injectable, Logger } from '@nestjs/common';
import { RabbitmqService } from './rabbitmq.service';

export type SagaStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';

export interface SagaStep {
  name: string;
  service: string;
  queue: string;
  compensationQueue: string;
  status: SagaStepStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  compensationStatus?: 'pending' | 'running' | 'completed' | 'failed';
  compensationDuration?: number;
}

export interface SagaLog {
  sagaId: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'compensated';
  steps: SagaStep[];
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  failedAtStep?: number;
  compensatedSteps?: number;
  payload: Record<string, unknown>;
}

export interface SagaConfig {
  failAtStep?: number; // 0-indexed, which step should simulate failure
  stepDelayMs?: number; // simulated processing delay per step
  compensationDelayMs?: number; // simulated compensation delay
}

@Injectable()
export class SagaOrchestratorService {
  private readonly logger = new Logger(SagaOrchestratorService.name);
  private sagaLogs: SagaLog[] = [];

  constructor(private readonly rabbitmqService: RabbitmqService) {}

  async runOrderSaga(
    payload: Record<string, unknown>,
    config: SagaConfig = {},
  ): Promise<SagaLog> {
    const sagaId = `SAGA-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const stepDelay = config.stepDelayMs ?? 500;
    const compDelay = config.compensationDelayMs ?? 300;

    const steps: SagaStep[] = [
      {
        name: 'Create Order',
        service: 'Order Service',
        queue: 'saga.order.create',
        compensationQueue: 'saga.order.cancel',
        status: 'pending',
      },
      {
        name: 'Reserve Payment',
        service: 'Payment Service',
        queue: 'saga.payment.reserve',
        compensationQueue: 'saga.payment.refund',
        status: 'pending',
      },
      {
        name: 'Reserve Inventory',
        service: 'Inventory Service',
        queue: 'saga.inventory.reserve',
        compensationQueue: 'saga.inventory.release',
        status: 'pending',
      },
      {
        name: 'Confirm Shipping',
        service: 'Shipping Service',
        queue: 'saga.shipping.confirm',
        compensationQueue: 'saga.shipping.cancel',
        status: 'pending',
      },
      {
        name: 'Send Notification',
        service: 'Notification Service',
        queue: 'saga.notification.send',
        compensationQueue: '',
        status: 'pending',
      },
    ];

    const sagaLog: SagaLog = {
      sagaId,
      name: 'Order Processing Saga',
      status: 'running',
      steps,
      startedAt: new Date().toISOString(),
      payload,
    };

    this.logger.log(`Starting saga ${sagaId}: Order Processing`);

    // Execute steps forward
    let failedIndex = -1;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      step.status = 'running';
      step.startedAt = new Date().toISOString();

      // Publish command to queue
      const message = JSON.stringify({
        sagaId,
        step: step.name,
        service: step.service,
        payload,
        timestamp: new Date().toISOString(),
      });

      try {
        await this.rabbitmqService.sendToQueue(step.queue, message);

        // Simulate processing delay
        await this.delay(stepDelay);

        // Check if this step should fail
        if (config.failAtStep !== undefined && config.failAtStep === i) {
          throw new Error(
            `Simulated failure at step "${step.name}" — ${step.service} is unavailable`,
          );
        }

        step.status = 'completed';
        step.completedAt = new Date().toISOString();
        step.duration = stepDelay;
        this.logger.log(`Saga ${sagaId} step ${i + 1}/${steps.length}: ${step.name} ✅`);
      } catch (err) {
        step.status = 'failed';
        step.completedAt = new Date().toISOString();
        step.duration = stepDelay;
        step.error = (err as Error).message;
        failedIndex = i;
        this.logger.error(`Saga ${sagaId} step ${i + 1}/${steps.length}: ${step.name} ❌ — ${step.error}`);
        break;
      }
    }

    // If a step failed, compensate in reverse order
    if (failedIndex >= 0) {
      sagaLog.status = 'failed';
      sagaLog.failedAtStep = failedIndex;

      this.logger.log(`Saga ${sagaId}: Starting compensation from step ${failedIndex}`);

      let compensated = 0;
      // Compensate completed steps in reverse (not the failed one, not steps after it)
      for (let i = failedIndex - 1; i >= 0; i--) {
        const step = steps[i];
        if (!step.compensationQueue) continue; // notification has no compensation

        step.compensationStatus = 'running';

        const compMessage = JSON.stringify({
          sagaId,
          step: `Compensate: ${step.name}`,
          service: step.service,
          originalStep: step.name,
          reason: `Rolling back due to failure at "${steps[failedIndex].name}"`,
          payload,
          timestamp: new Date().toISOString(),
        });

        try {
          await this.rabbitmqService.sendToQueue(step.compensationQueue, compMessage);
          await this.delay(compDelay);
          step.compensationStatus = 'completed';
          step.compensationDuration = compDelay;
          compensated++;
          this.logger.log(`Saga ${sagaId} compensate: ${step.name} ↩️ done`);
        } catch (err) {
          step.compensationStatus = 'failed';
          this.logger.error(`Saga ${sagaId} compensate failed: ${step.name}`);
        }
      }

      sagaLog.compensatedSteps = compensated;
      sagaLog.status = 'compensated';
    } else {
      sagaLog.status = 'completed';
    }

    sagaLog.completedAt = new Date().toISOString();
    sagaLog.totalDuration =
      new Date(sagaLog.completedAt).getTime() - new Date(sagaLog.startedAt).getTime();

    // Store log
    this.sagaLogs.unshift(sagaLog);
    if (this.sagaLogs.length > 20) {
      this.sagaLogs = this.sagaLogs.slice(0, 20);
    }

    this.logger.log(
      `Saga ${sagaId} finished: ${sagaLog.status} (${sagaLog.totalDuration}ms)`,
    );

    return sagaLog;
  }

  getSagaLogs(): SagaLog[] {
    return this.sagaLogs;
  }

  getSagaById(sagaId: string): SagaLog | undefined {
    return this.sagaLogs.find((s) => s.sagaId === sagaId);
  }

  clearLogs(): void {
    this.sagaLogs = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
