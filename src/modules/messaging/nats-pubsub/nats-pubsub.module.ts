import { Module } from '@nestjs/common';
import { NatsPubSubService } from './nats-pubsub.service';
import { NatsMonitorController } from './nats-monitor.controller';

@Module({
  controllers: [NatsMonitorController],
  providers: [NatsPubSubService],
  exports: [NatsPubSubService],
})
export class NatsPubSubModule {}
