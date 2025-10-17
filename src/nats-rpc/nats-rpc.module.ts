import { Module } from '@nestjs/common';
import { NatsRpcController } from './nats-rpc.controller';
import { NatsRpcService } from './nats-rpc.service';

@Module({
  controllers: [NatsRpcController],
  providers: [NatsRpcService],
  exports: [NatsRpcService],
})
export class NatsRpcModule {}
