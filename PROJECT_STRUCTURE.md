# 📁 Project Structure Documentation

## Overview

This document describes the reorganized project structure following NestJS best practices and enterprise-grade application architecture.

## 🗂️ Complete Directory Structure

```
messaging-patterns/
├── src/
│   ├── core/                          # ✨ NEW - Core shared functionality
│   │   ├── base/
│   │   │   └── base-messaging.service.ts      # Base class for messaging services
│   │   ├── common/
│   │   │   ├── constants/
│   │   │   │   ├── default-config.constant.ts # Default configuration values
│   │   │   │   └── message-types.constant.ts  # Message and task enums
│   │   │   └── helpers/
│   │   │       └── retry.helper.ts            # Retry logic and exponential backoff
│   │   ├── exceptions/
│   │   │   └── all-exceptions.filter.ts       # Global exception handler
│   │   ├── interceptors/
│   │   │   └── logging.interceptor.ts         # HTTP request logging
│   │   └── interfaces/
│   │       ├── api-response.interface.ts      # Standard API responses
│   │       └── pagination.interface.ts        # Pagination interfaces
│   │
│   ├── config/                        # ✨ NEW - Configuration management
│   │   ├── app.config.ts              # Application configuration
│   │   ├── database.config.ts         # MongoDB configuration
│   │   ├── nats.config.ts             # NATS configuration
│   │   ├── rabbitmq.config.ts         # RabbitMQ configuration
│   │   ├── redis.config.ts            # Redis configuration
│   │   └── websocket.config.ts        # WebSocket configuration
│   │
│   ├── messaging/                     # ✨ REORGANIZED - All messaging patterns
│   │   ├── websocket/
│   │   │   ├── dto/
│   │   │   │   └── message.dto.ts
│   │   │   ├── auth.guard.ts
│   │   │   ├── websocket.gateway.ts
│   │   │   └── websocket.module.ts
│   │   ├── redis-pubsub/
│   │   │   ├── dto/
│   │   │   │   └── publish.dto.ts
│   │   │   ├── redis-pubsub.controller.ts
│   │   │   ├── redis-pubsub.service.ts
│   │   │   └── redis-pubsub.module.ts
│   │   ├── nats-rpc/
│   │   │   ├── nats-rpc.controller.ts
│   │   │   ├── nats-rpc.service.ts
│   │   │   └── nats-rpc.module.ts
│   │   └── rabbitmq/
│   │       ├── rabbitmq.controller.ts
│   │       ├── rabbitmq.service.ts
│   │       └── rabbitmq.module.ts
│   │
│   ├── persistence/                   # ✨ REORGANIZED - Data persistence layer
│   │   └── mongodb/
│   │       ├── dto/
│   │       │   ├── create-message.dto.ts
│   │       │   ├── update-message.dto.ts
│   │       │   └── query-message.dto.ts
│   │       ├── schemas/
│   │       │   └── message.schema.ts
│   │       ├── mongodb.controller.ts
│   │       ├── mongodb.service.ts
│   │       └── mongodb.module.ts
│   │
│   ├── integrations/                  # ✨ REORGANIZED - Integration examples
│   │   ├── examples/
│   │   │   ├── examples.controller.ts
│   │   │   ├── examples.service.ts
│   │   │   └── examples.module.ts
│   │   ├── task-system/
│   │   │   ├── task.dto.ts
│   │   │   ├── task-system.controller.ts
│   │   │   ├── task-system.service.ts
│   │   │   └── task-system.module.ts
│   │   └── final-project/
│   │       ├── final-project.controller.ts
│   │       └── final-project.module.ts
│   │
│   ├── health/                        # ✨ NEW - Health monitoring
│   │   ├── indicators/                # Reserved for health indicators
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   │
│   ├── app.module.ts                  # Root module with organized imports
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── main.ts                        # Application bootstrap
│
├── test/                              # Test files
├── docs/                              # Documentation
├── public/                            # Static assets
├── docker-compose.yml                 # Service orchestration
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📋 Key Improvements

### 1. **Core Module** (`src/core/`)

Centralized shared functionality used across all modules:

#### **Interfaces**
- `api-response.interface.ts` - Standardized API response formats
- `pagination.interface.ts` - Pagination parameters and metadata

#### **Base Classes**
- `base-messaging.service.ts` - Abstract base class for messaging services with lifecycle management

#### **Constants**
- `default-config.constant.ts` - Default configuration values for all services
- `message-types.constant.ts` - Enums for message types, statuses, and task statuses

#### **Helpers**
- `retry.helper.ts` - Retry logic with exponential backoff

#### **Exceptions**
- `all-exceptions.filter.ts` - Global exception filter for standardized error responses

#### **Interceptors**
- `logging.interceptor.ts` - HTTP request/response logging

---

### 2. **Config Module** (`src/config/`)

Type-safe configuration using NestJS ConfigModule:

- **app.config.ts** - Port, environment, CORS settings
- **database.config.ts** - MongoDB connection configuration
- **redis.config.ts** - Redis host, port, retry settings
- **nats.config.ts** - NATS URL and timeout configuration
- **rabbitmq.config.ts** - RabbitMQ URL and queue options
- **websocket.config.ts** - WebSocket CORS, timeouts, token settings

All configs use the `registerAs` pattern and read from environment variables with sensible defaults.

---

### 3. **Messaging Module** (`src/messaging/`)

All messaging patterns grouped together:

- **websocket/** - Socket.IO real-time communication
- **redis-pubsub/** - Redis pub/sub with SSE support
- **nats-rpc/** - NATS request/response pattern
- **rabbitmq/** - RabbitMQ queue management

**Benefits:**
- Clear separation of messaging concerns
- Easy to understand the messaging layer at a glance
- Consistent import paths

---

### 4. **Persistence Module** (`src/persistence/`)

Database and data persistence layer:

- **mongodb/** - MongoDB integration with Mongoose
  - Complete CRUD operations
  - Message filtering and pagination
  - Conversation and channel queries

**Benefits:**
- Separates data access from business logic
- Easily extensible for additional databases (PostgreSQL, Redis, etc.)
- Clear data layer boundary

---

### 5. **Integrations Module** (`src/integrations/`)

Real-world integration examples:

- **examples/** - Learning examples combining patterns
- **task-system/** - Production-like task orchestration system
- **final-project/** - Template for comprehensive implementations

**Benefits:**
- Shows practical use cases
- Educational reference implementations
- Demonstrates multi-pattern coordination

---

### 6. **Health Module** (`src/health/`)

Service health monitoring:

- **health.controller.ts** - Health check endpoints
  - `GET /health` - Overall health status
  - `GET /health/ready` - Readiness probe
  - `GET /health/live` - Liveness probe

**Benefits:**
- Kubernetes/Docker health checks
- Monitoring integration
- Service status visibility

---

## 📦 Module Organization Pattern

Each feature module follows this consistent structure:

```
feature-name/
├── dto/                    # Data transfer objects
│   ├── create-*.dto.ts
│   ├── update-*.dto.ts
│   └── query-*.dto.ts
├── schemas/                # Database schemas (if applicable)
├── interfaces/             # TypeScript interfaces
├── guards/                 # Feature-specific guards
├── *.controller.ts         # HTTP/Gateway layer
├── *.service.ts            # Business logic
└── *.module.ts             # Module definition
```

---

## 🔄 Import Path Updates

### Before (Old Structure)
```typescript
import { WebsocketModule } from './websocket/websocket.module';
import { RedisPubsubModule } from './redis-pubsub/redis-pubsub.module';
import { MongodbModule } from './mongodb/mongodb.module';
```

### After (New Structure)
```typescript
import { WebsocketModule } from './messaging/websocket/websocket.module';
import { RedisPubsubModule } from './messaging/redis-pubsub/redis-pubsub.module';
import { MongodbModule } from './persistence/mongodb/mongodb.module';
```

**All imports have been updated throughout the codebase!**

---

## 🎯 Benefits of New Structure

### 1. **Scalability**
- Easy to add new modules in appropriate domain folders
- Clear separation of concerns
- Reduced coupling between modules

### 2. **Maintainability**
- Logical grouping makes code easier to find
- Shared code in `core/` reduces duplication
- Consistent patterns across all modules

### 3. **Testability**
- Core utilities can be tested in isolation
- Module boundaries make mocking easier
- Clear dependencies

### 4. **Developer Experience**
- Intuitive folder structure
- Self-documenting organization
- Easy onboarding for new developers

### 5. **Enterprise-Ready**
- Follows NestJS best practices
- Configuration management
- Health monitoring
- Standardized error handling

---

## 🚀 Usage Guide

### Adding a New Messaging Pattern

1. Create folder in `src/messaging/new-pattern/`
2. Implement service, controller, module
3. Add configuration in `src/config/new-pattern.config.ts`
4. Import module in `src/app.module.ts`

### Adding Core Utilities

1. Identify reusable functionality
2. Add to appropriate `src/core/` subfolder
3. Export from the file
4. Import where needed using `../../../core/...`

### Adding Health Indicators

1. Create indicator in `src/health/indicators/`
2. Implement health check logic
3. Register in `health.controller.ts`

---

## 📊 Module Dependency Graph

```
app.module
├── ConfigModule (global)
├── MongooseModule (global)
├── messaging/
│   ├── WebsocketModule
│   ├── RedisPubsubModule
│   ├── NatsRpcModule
│   └── RabbitmqModule
├── persistence/
│   └── MongodbModule
├── integrations/
│   ├── ExamplesModule
│   │   ├── → NatsRpcModule
│   │   ├── → RabbitmqModule
│   │   └── → RedisPubsubModule
│   ├── TaskSystemModule
│   │   ├── → NatsRpcModule
│   │   ├── → RabbitmqModule
│   │   └── → RedisPubsubModule
│   └── FinalProjectModule
└── health/
    └── HealthModule
```

---

## ✅ Verification

The project has been successfully restructured and verified:

- ✅ All files moved to new locations
- ✅ All import paths updated
- ✅ TypeScript compilation successful (`npm run build`)
- ✅ No linting errors
- ✅ Configuration properly loaded
- ✅ Health endpoints working

---

## 🔗 Quick Links

- [Main README](./README.md)
- [CLAUDE.md - AI Assistant Guide](./CLAUDE.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Examples Guide](./EXAMPLES_GUIDE.md)
- [Task System Guide](./TASK_SYSTEM_GUIDE.md)

---

## 📝 Notes

- The project uses **NestJS v11** with updated patterns
- All messaging services implement lifecycle hooks
- Configuration uses environment variables with defaults
- Health checks are compatible with Kubernetes
- Structure supports horizontal scaling

**Last Updated:** 2025-11-01
**Build Status:** ✅ Passing
