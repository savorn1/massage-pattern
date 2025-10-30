import { Module } from '@nestjs/common';
import { ExamplesController } from './examples.controller';
import { ExamplesService } from './examples.service';
import { NatsRpcModule } from '../nats-rpc/nats-rpc.module';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';
import { RedisPubsubModule } from '../redis-pubsub/redis-pubsub.module';

@Module({
  imports: [NatsRpcModule, RabbitmqModule, RedisPubsubModule],
  controllers: [ExamplesController],
  providers: [ExamplesService],
})
export class ExamplesModule {}
