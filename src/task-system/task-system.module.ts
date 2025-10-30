import { Module } from '@nestjs/common';
import { TaskSystemController } from './task-system.controller';
import { TaskSystemService } from './task-system.service';
import { NatsRpcModule } from '../nats-rpc/nats-rpc.module';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';
import { RedisPubsubModule } from '../redis-pubsub/redis-pubsub.module';

@Module({
  imports: [NatsRpcModule, RabbitmqModule, RedisPubsubModule],
  controllers: [TaskSystemController],
  providers: [TaskSystemService],
})
export class TaskSystemModule {}
