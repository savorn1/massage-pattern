import { Module } from '@nestjs/common';
import { NatsPubSubService } from './nats-pubsub.service';

@Module({
  providers: [NatsPubSubService],
  exports: [NatsPubSubService],
})
export class NatsPubSubModule {}
