import { Module } from '@nestjs/common';
import { TaskSystemController } from './task-system.controller';
import { TaskSystemService } from './task-system.service';
import { NatsRpcModule } from '../../modules/messaging/nats-rpc/nats-rpc.module';
import { RabbitmqModule } from '../../modules/messaging/rabbitmq/rabbitmq.module';
import { RedisPubsubModule } from '../../modules/messaging/redis-pubsub/redis-pubsub.module';

@Module({
  imports: [NatsRpcModule, RabbitmqModule, RedisPubsubModule],
  controllers: [TaskSystemController],
  providers: [TaskSystemService],
})
export class TaskSystemModule {}
