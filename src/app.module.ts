import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import natsConfig from './config/nats.config';
import rabbitmqConfig from './config/rabbitmq.config';
import websocketConfig from './config/websocket.config';

// Infrastructure (Database, External Services)
import { DatabaseModule } from './infrastructure/database/database.module';

// Messaging Patterns (Pub/Sub, Streams, RabbitMQ, NATS, WebSocket)
import { MessagingModule } from './modules/messaging/messaging.module';

// Workers (BullMQ Background Jobs)
import { WorkersModule } from './workers/workers.module';

// Features (Business Logic - Users, Orders, Products)
import { FeaturesModule } from './modules/features.module';

// Integrations (Examples, Comparisons)
import { IntegrationsModule } from './integrations/integrations.module';

// Health Monitoring
import { HealthModule } from './modules/health/health.module';

// Security (Rate Limiting)
import { ThrottleModule } from './core/throttle/throttle.module';

/**
 * App Module - Application Root
 *
 * Structure:
 * ├── Config          - Environment configuration
 * ├── Infrastructure  - Database connections
 * ├── Messaging       - All messaging patterns
 * ├── Workers         - Background job processing
 * ├── Features        - Business domain modules
 * ├── Integrations    - Examples and demos
 * └── Health          - Service monitoring
 */
@Module({
  imports: [
    // ══════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ══════════════════════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════════════════════
    // INFRASTRUCTURE
    // ══════════════════════════════════════════════════════════════════════
    DatabaseModule,

    // ══════════════════════════════════════════════════════════════════════
    // MESSAGING PATTERNS
    // ══════════════════════════════════════════════════════════════════════
    MessagingModule,

    // ══════════════════════════════════════════════════════════════════════
    // WORKERS (Background Jobs)
    // ══════════════════════════════════════════════════════════════════════
    WorkersModule,

    // ══════════════════════════════════════════════════════════════════════
    // FEATURES (Business Logic)
    // ══════════════════════════════════════════════════════════════════════
    FeaturesModule,

    // ══════════════════════════════════════════════════════════════════════
    // INTEGRATIONS (Examples & Demos)
    // ══════════════════════════════════════════════════════════════════════
    IntegrationsModule,

    // ══════════════════════════════════════════════════════════════════════
    // SECURITY (Rate Limiting)
    // ══════════════════════════════════════════════════════════════════════
    ThrottleModule,

    // ══════════════════════════════════════════════════════════════════════
    // HEALTH MONITORING
    // ══════════════════════════════════════════════════════════════════════
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
