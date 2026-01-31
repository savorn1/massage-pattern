# Project Structure Best Practices

This document explains the project structure and NestJS best practices.

## Current Structure

```
src/
├── app.module.ts              # Root module
├── main.ts                    # Application entry point
│
├── config/                    # ✅ Configuration files
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── nats.config.ts
│   ├── rabbitmq.config.ts
│   └── websocket.config.ts
│
├── core/                      # ✅ Framework utilities
│   ├── base/                  # Base classes
│   ├── common/                # Shared utilities
│   │   ├── constants/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── helpers/
│   │   └── utils/
│   ├── database/              # Database base classes
│   ├── exceptions/            # Custom exceptions & filters
│   ├── interceptors/          # HTTP interceptors
│   └── interfaces/            # Shared interfaces
│
├── infrastructure/            # ✅ External services (NEW)
│   ├── messaging/             # Message brokers
│   │   ├── pubsub/           # Redis Pub/Sub
│   │   ├── streams/          # Redis Streams
│   │   ├── rabbitmq/         # RabbitMQ
│   │   ├── nats/             # NATS RPC
│   │   └── websocket/        # Socket.IO
│   ├── database/             # Database adapters
│   │   └── mongodb/
│   └── queue/                # Job queues
│       └── bullmq/
│
├── domain/                    # ✅ Business logic (NEW)
│   ├── users/
│   ├── orders/
│   └── products/
│
└── shared/                    # ✅ Shared feature modules
    ├── health/
    └── examples/
```

## Module Organization Pattern

Each module should follow this structure:

```
module-name/
├── module-name.module.ts      # Module definition
├── module-name.controller.ts  # HTTP endpoints
├── module-name.service.ts     # Business logic
├── module-name.gateway.ts     # WebSocket (if needed)
├── dto/                       # Data Transfer Objects
│   ├── create-*.dto.ts
│   ├── update-*.dto.ts
│   └── query-*.dto.ts
├── entities/                  # Database entities
│   └── *.entity.ts
├── interfaces/                # Module-specific interfaces
│   └── *.interface.ts
└── __tests__/                 # Unit tests
    └── *.spec.ts
```

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
│   Controllers, Gateways, Resolvers (GraphQL)                        │
│   - Handle HTTP/WebSocket requests                                  │
│   - Validate input (DTOs)                                           │
│   - Return responses                                                │
├─────────────────────────────────────────────────────────────────────┤
│                         APPLICATION LAYER                           │
│   Services (Use Cases)                                              │
│   - Business logic orchestration                                    │
│   - Call domain services                                            │
│   - Transaction management                                          │
├─────────────────────────────────────────────────────────────────────┤
│                          DOMAIN LAYER                               │
│   Entities, Domain Services, Repositories                           │
│   - Core business rules                                             │
│   - Entity definitions                                              │
│   - Repository interfaces                                           │
├─────────────────────────────────────────────────────────────────────┤
│                       INFRASTRUCTURE LAYER                          │
│   Database, Messaging, External APIs                                │
│   - Repository implementations                                      │
│   - Message broker adapters                                         │
│   - Third-party integrations                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Best Practices

### 1. Single Responsibility
Each module/service should do ONE thing well.

```typescript
// ❌ Bad - Service does too much
class UserService {
  createUser() {}
  sendEmail() {}
  processPayment() {}
  generateReport() {}
}

// ✅ Good - Focused services
class UserService {
  createUser() {}
  updateUser() {}
  deleteUser() {}
}

class EmailService {
  sendEmail() {}
}

class PaymentService {
  processPayment() {}
}
```

### 2. Dependency Injection
Always inject dependencies, never instantiate directly.

```typescript
// ❌ Bad
class OrderService {
  private emailService = new EmailService();
}

// ✅ Good
class OrderService {
  constructor(private readonly emailService: EmailService) {}
}
```

### 3. Configuration Management
Use ConfigService for environment-based configuration.

```typescript
// ❌ Bad - Hardcoded values
const redisHost = 'localhost';

// ✅ Good - Environment variables
@Injectable()
class RedisService {
  constructor(private config: ConfigService) {
    const host = this.config.get('REDIS_HOST');
  }
}
```

### 4. Error Handling
Use custom exceptions and global filters.

```typescript
// ❌ Bad - Generic errors
throw new Error('User not found');

// ✅ Good - HTTP exceptions
throw new NotFoundException('User not found');

// ✅ Better - Custom exceptions
throw new UserNotFoundException(userId);
```

### 5. DTO Validation
Always validate input with class-validator.

```typescript
// ✅ Good - Validated DTO
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### 6. Response Formatting
Use consistent response structure.

```typescript
// ✅ Consistent API response
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page: number;
    total: number;
  };
}
```

## Messaging Patterns Best Practices

### When to Use Each Pattern

```
┌─────────────────┬──────────────────────────────────────────────────┐
│ Pattern         │ Use Case                                         │
├─────────────────┼──────────────────────────────────────────────────┤
│ Redis Pub/Sub   │ Real-time broadcasts, cache invalidation         │
│ Redis Streams   │ Event sourcing, audit logs, message history      │
│ RabbitMQ        │ Reliable job queues, complex routing             │
│ NATS            │ Microservices RPC, request/response              │
│ BullMQ          │ Background jobs, scheduled tasks, retries        │
│ WebSocket       │ Real-time bidirectional communication            │
└─────────────────┴──────────────────────────────────────────────────┘
```

### Service Lifecycle

Always implement lifecycle hooks for external connections:

```typescript
@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }
}
```

## File Naming Conventions

```
├── user.controller.ts         # Controllers
├── user.service.ts            # Services
├── user.module.ts             # Modules
├── user.entity.ts             # Entities
├── user.repository.ts         # Repositories
├── user.gateway.ts            # WebSocket gateways
├── user.guard.ts              # Guards
├── user.interceptor.ts        # Interceptors
├── user.pipe.ts               # Pipes
├── user.filter.ts             # Exception filters
├── user.decorator.ts          # Decorators
├── user.interface.ts          # Interfaces
├── user.enum.ts               # Enums
├── user.constant.ts           # Constants
├── create-user.dto.ts         # DTOs (action-name.dto.ts)
└── user.spec.ts               # Tests
```

## Import Order Convention

```typescript
// 1. NestJS core imports
import { Module, Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// 2. Third-party imports
import { MongooseModule } from '@nestjs/mongoose';
import Redis from 'ioredis';

// 3. Internal imports - by layer
import { CoreModule } from './core/core.module';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

// 4. Relative imports
import { User } from './entities/user.entity';
```

## Testing Structure

```
src/
├── user/
│   ├── user.service.ts
│   ├── user.controller.ts
│   └── __tests__/
│       ├── user.service.spec.ts      # Unit tests
│       └── user.controller.spec.ts
│
test/
├── user.e2e-spec.ts                  # E2E tests
└── jest-e2e.json
```
