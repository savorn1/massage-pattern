import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration imports
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import natsConfig from './config/nats.config';
import rabbitmqConfig from './config/rabbitmq.config';
import websocketConfig from './config/websocket.config';

// Messaging pattern modules
import { WebsocketModule } from './messaging/websocket/websocket.module';
import { RedisPubsubModule } from './messaging/redis-pubsub/redis-pubsub.module';
import { NatsRpcModule } from './messaging/nats-rpc/nats-rpc.module';
import { RabbitmqModule } from './messaging/rabbitmq/rabbitmq.module';

// Persistence modules
import { MongodbModule } from './persistence/mongodb/mongodb.module';

// Integration modules
import { ExamplesModule } from './integrations/examples/examples.module';
import { TaskSystemModule } from './integrations/task-system/task-system.module';
import { FinalProjectModule } from './integrations/final-project/final-project.module';

// Health module
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Global configuration with config files
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        natsConfig,
        rabbitmqConfig,
        websocketConfig,
      ],
    }),

    // Database connection
    MongooseModule.forRoot(
      process.env.MONGODB_URI ||
        'mongodb://admin:password@localhost:27017/messaging-patterns?authSource=admin',
    ),

    // Messaging pattern modules
    WebsocketModule,
    RedisPubsubModule,
    NatsRpcModule,
    RabbitmqModule,

    // Persistence modules
    MongodbModule,

    // Integration modules
    ExamplesModule,
    TaskSystemModule,
    FinalProjectModule,

    // Health monitoring
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
