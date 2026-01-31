import { Module } from '@nestjs/common';
import { RedisPubsubController } from './redis-pubsub.controller';
import { RedisPubsubService } from './redis-pubsub.service';

@Module({
  controllers: [RedisPubsubController],
  providers: [RedisPubsubService],
  exports: [RedisPubsubService],
})
export class RedisPubsubModule {}
