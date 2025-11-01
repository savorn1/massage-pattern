import { Module } from '@nestjs/common';
import { ExamplesController } from './examples.controller';
import { ExamplesService } from './examples.service';
import { NatsRpcModule } from '../../messaging/nats-rpc/nats-rpc.module';
import { RabbitmqModule } from '../../messaging/rabbitmq/rabbitmq.module';
import { RedisPubsubModule } from '../../messaging/redis-pubsub/redis-pubsub.module';

@Module({
  imports: [NatsRpcModule, RabbitmqModule, RedisPubsubModule],
  controllers: [ExamplesController],
  providers: [ExamplesService],
})
export class ExamplesModule {}
