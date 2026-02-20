import { Module } from '@nestjs/common';
import { RabbitmqController } from './rabbitmq.controller';
import { RabbitmqService } from './rabbitmq.service';
import { SagaOrchestratorService } from './saga-orchestrator.service';
import { DlqService } from './dlq.service';
import { OutboxService } from './outbox.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { BackpressureService } from './backpressure.service';

@Module({
  controllers: [RabbitmqController],
  providers: [RabbitmqService, SagaOrchestratorService, DlqService, OutboxService, CircuitBreakerService, BackpressureService],
  exports: [RabbitmqService, SagaOrchestratorService, DlqService, OutboxService, CircuitBreakerService, BackpressureService],
})
export class RabbitmqModule {}
