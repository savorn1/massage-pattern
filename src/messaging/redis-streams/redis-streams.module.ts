import { Module } from '@nestjs/common';
import { RedisStreamsService } from './redis-streams.service';
import { RedisStreamsController } from './redis-streams.controller';

@Module({
  controllers: [RedisStreamsController],
  providers: [RedisStreamsService],
  exports: [RedisStreamsService],
})
export class RedisStreamsModule {}
