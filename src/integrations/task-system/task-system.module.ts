import { Module } from '@nestjs/common';
import { TaskSystemController } from './task-system.controller';
import { TaskSystemService } from './task-system.service';
import { NatsRpcModule } from '../../messaging/nats-rpc/nats-rpc.module';
import { RabbitmqModule } from '../../messaging/rabbitmq/rabbitmq.module';
import { RedisPubsubModule } from '../../messaging/redis-pubsub/redis-pubsub.module';

@Module({
  imports: [NatsRpcModule, RabbitmqModule, RedisPubsubModule],
  controllers: [TaskSystemController],
  providers: [TaskSystemService],
})
export class TaskSystemModule {}
