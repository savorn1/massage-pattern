import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebsocketModule } from './websocket/websocket.module';
import { RedisPubsubModule } from './redis-pubsub/redis-pubsub.module';
import { NatsRpcModule } from './nats-rpc/nats-rpc.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { FinalProjectModule } from './final-project/final-project.module';
import { ExamplesModule } from './examples/examples.module';
import { TaskSystemModule } from './task-system/task-system.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WebsocketModule,
    RedisPubsubModule,
    NatsRpcModule,
    RabbitmqModule,
    FinalProjectModule,
    ExamplesModule,
    TaskSystemModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
