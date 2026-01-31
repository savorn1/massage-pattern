import { Module } from '@nestjs/common';
import { ExamplesController } from './examples.controller';
import { ExamplesService } from './examples.service';
import { NatsRpcModule } from '../../modules/messaging/nats-rpc/nats-rpc.module';
import { RabbitmqModule } from '../../modules/messaging/rabbitmq/rabbitmq.module';
import { RedisPubsubModule } from '../../modules/messaging/redis-pubsub/redis-pubsub.module';

@Module({
  imports: [NatsRpcModule, RabbitmqModule, RedisPubsubModule],
  controllers: [ExamplesController],
  providers: [ExamplesService],
})
export class ExamplesModule {}
