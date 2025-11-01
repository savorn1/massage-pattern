# 🛡️ Error Handling Guide

## Overview

This project implements a comprehensive, type-safe error handling system with custom exceptions, global filters, and standardized error responses.

## 📚 Table of Contents

- [Architecture](#architecture)
- [Custom Exceptions](#custom-exceptions)
- [Usage Examples](#usage-examples)
- [Error Response Format](#error-response-format)
- [Best Practices](#best-practices)
- [Testing Errors](#testing-errors)

---

## Architecture

### Components

```
src/core/
├── exceptions/
│   ├── http-exception.filter.ts      # Global exception filter
│   ├── business.exception.ts         # Business logic errors
│   ├── messaging.exception.ts        # Messaging broker errors
│   ├── database.exception.ts         # Database operation errors
│   └── validation.exception.ts       # Validation errors
├── interfaces/
│   └── api-response.interface.ts     # Error response types
└── common/
    └── utils/
        └── error-handler.util.ts     # Error handling utilities
```

### Error Flow

```
Request → Controller → Service
                ↓ (Exception thrown)
        HttpExceptionFilter
                ↓
    Standardized Error Response
```

---

## Custom Exceptions

### 1. BusinessException

For domain/business logic violations.

**Location**: `src/core/exceptions/business.exception.ts`

#### Factory Methods

```typescript
import { BusinessException } from '@/core/exceptions/business.exception';

// Invalid operation
throw BusinessException.invalidOperation(
  'Cannot delete order that has been shipped',
  { orderId: '123', status: 'shipped' }
);

// Resource not found
throw BusinessException.resourceNotFound('User', 'user-123');

// Duplicate resource
throw BusinessException.duplicateResource('User', 'email');

// Validation failed
throw BusinessException.validationFailed(
  'Invalid input data',
  { field: 'age', error: 'Must be 18 or older' }
);
```

#### Response Example
```json
{
  "success": false,
  "error": "Business Error",
  "message": "Cannot delete order that has been shipped",
  "statusCode": 400,
  "timestamp": "2025-11-01T10:30:00.000Z",
  "path": "/orders/123",
  "errorCode": "INVALID_OPERATION",
  "details": {
    "orderId": "123",
    "status": "shipped"
  }
}
```

---

### 2. MessagingException

For message broker connection and operation errors.

**Location**: `src/core/exceptions/messaging.exception.ts`

#### Factory Methods

```typescript
import { MessagingException } from '@/core/exceptions/messaging.exception';

// Connection failed
throw MessagingException.connectionFailed('redis', error);

// Publish failed
throw MessagingException.publishFailed('nats', 'user.created', error);

// Subscribe failed
throw MessagingException.subscribeFailed('rabbitmq', 'tasks', error);

// Timeout error
throw MessagingException.timeoutError('nats', 'request', 5000);
```

#### Response Example
```json
{
  "success": false,
  "error": "Messaging Error",
  "message": "Failed to publish message to nats channel: user.created",
  "statusCode": 503,
  "timestamp": "2025-11-01T10:30:00.000Z",
  "path": "/nats-rpc/publish",
  "details": {
    "broker": "nats",
    "operation": "publish",
    "originalError": "Connection timeout"
  }
}
```

---

### 3. DatabaseException

For database operation errors.

**Location**: `src/core/exceptions/database.exception.ts`

#### Factory Methods

```typescript
import { DatabaseException } from '@/core/exceptions/database.exception';

// Operation failed
throw DatabaseException.operationFailed('create', 'users', error);

// Connection failed
throw DatabaseException.connectionFailed(error);

// Query timeout
throw DatabaseException.queryTimeout('messages', 5000);

// Duplicate key
throw DatabaseException.duplicateKey('users', 'email');
```

#### Response Example
```json
{
  "success": false,
  "error": "Database Error",
  "message": "Database create operation failed on users",
  "statusCode": 500,
  "timestamp": "2025-11-01T10:30:00.000Z",
  "path": "/users",
  "details": {
    "operation": "create",
    "collection": "users",
    "originalError": "Duplicate key error"
  }
}
```

---

### 4. ValidationException

For detailed validation errors.

**Location**: `src/core/exceptions/validation.exception.ts`

#### Usage

```typescript
import { ValidationException } from '@/core/exceptions/validation.exception';

// Single field error
throw ValidationException.singleField('email', 'Invalid email format', 'notanemail');

// Multiple field errors
throw new ValidationException('Validation failed', [
  { field: 'email', message: 'Invalid email format', value: 'invalid' },
  { field: 'age', message: 'Must be 18 or older', value: 15 },
]);
```

#### Response Example
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Validation failed",
  "statusCode": 400,
  "timestamp": "2025-11-01T10:30:00.000Z",
  "path": "/users",
  "fieldErrors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "notanemail",
      "constraint": "isEmail"
    },
    {
      "field": "age",
      "message": "Must be 18 or older",
      "value": 15,
      "constraint": "min"
    }
  ]
}
```

---

## Usage Examples

### In Controllers

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { BusinessException } from '@/core/exceptions/business.exception';

@Controller('users')
export class UsersController {
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw BusinessException.resourceNotFound('User', id);
    }

    return user;
  }
}
```

### In Services

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ErrorHandler } from '@/core/common/utils/error-handler.util';
import { DatabaseException } from '@/core/exceptions/database.exception';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async createUser(dto: CreateUserDto) {
    return ErrorHandler.handleDatabaseOperation(
      () => this.userModel.create(dto),
      'create',
      'users',
      this.logger,
    );
  }

  async sendNotification(userId: string) {
    return ErrorHandler.handleMessagingOperation(
      () => this.redisService.publish('notifications', { userId }),
      'redis',
      'publish',
      this.logger,
    );
  }
}
```

### With Async Wrapper

```typescript
import { ErrorHandler } from '@/core/common/utils/error-handler.util';

async processTask(taskId: string) {
  return ErrorHandler.handleAsync(
    async () => {
      // Your async operation
      const result = await this.externalApi.process(taskId);
      return result;
    },
    'Failed to process task',
    this.logger,
  );
}
```

---

## Error Response Format

### Standard Error Response

All errors follow this structure:

```typescript
interface ErrorResponse {
  success: false;
  error: string;              // Error type (e.g., "Business Error")
  message: string;            // Human-readable message
  statusCode: number;         // HTTP status code
  timestamp: string;          // ISO 8601 timestamp
  path: string;               // Request path
  errorCode?: string;         // Optional error code
  details?: object;           // Optional additional details
  fieldErrors?: Array<...>;   // Optional validation errors
  stack?: string;             // Stack trace (dev only)
}
```

### Success Response

For comparison, success responses look like:

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
}
```

---

## Best Practices

### 1. **Use Specific Exceptions**

❌ **Bad**:
```typescript
throw new Error('User not found');
```

✅ **Good**:
```typescript
throw BusinessException.resourceNotFound('User', userId);
```

### 2. **Include Context in Details**

❌ **Bad**:
```typescript
throw BusinessException.invalidOperation('Operation failed');
```

✅ **Good**:
```typescript
throw BusinessException.invalidOperation(
  'Cannot process refund for completed order',
  { orderId, status: 'completed', attemptedAction: 'refund' }
);
```

### 3. **Use Error Handler Utilities**

❌ **Bad**:
```typescript
try {
  await this.database.create(data);
} catch (error) {
  this.logger.error('Create failed', error);
  throw error; // Re-throws raw error
}
```

✅ **Good**:
```typescript
return ErrorHandler.handleDatabaseOperation(
  () => this.database.create(data),
  'create',
  'users',
  this.logger,
);
```

### 4. **Log Before Throwing**

```typescript
async deleteUser(id: string) {
  const user = await this.findById(id);

  if (!user) {
    this.logger.warn(`Attempted to delete non-existent user: ${id}`);
    throw BusinessException.resourceNotFound('User', id);
  }

  this.logger.log(`Deleting user: ${id}`);
  return await this.userModel.delete(id);
}
```

### 5. **Don't Catch Errors Unless You Can Handle Them**

❌ **Bad**:
```typescript
try {
  return await this.service.process();
} catch (error) {
  console.log(error); // Just logging and swallowing
  return null;
}
```

✅ **Good**:
```typescript
// Let error propagate to global filter
return await this.service.process();

// OR handle it meaningfully
try {
  return await this.service.process();
} catch (error) {
  this.logger.error('Processing failed', error);
  throw BusinessException.invalidOperation(
    'Failed to process request',
    { reason: ErrorHandler.getErrorMessage(error) }
  );
}
```

---

## Testing Errors

### Manual Testing

```bash
# Test 404 error
curl http://localhost:3000/users/nonexistent

# Test validation error
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid"}'

# Test messaging error (requires stopped broker)
docker-compose stop redis
curl -X POST http://localhost:3000/redis-pubsub/publish \
  -H "Content-Type: application/json" \
  -d '{"channel":"test","message":"hello"}'
```

### Unit Testing

```typescript
import { Test } from '@nestjs/testing';
import { BusinessException } from '@/core/exceptions/business.exception';

describe('UsersService', () => {
  it('should throw BusinessException when user not found', async () => {
    await expect(
      service.findById('nonexistent')
    ).rejects.toThrow(BusinessException);

    await expect(
      service.findById('nonexistent')
    ).rejects.toMatchObject({
      message: expect.stringContaining('not found'),
      getStatus: expect.any(Function),
    });
  });
});
```

---

## Error Codes Reference

### Business Errors (400-409)

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_OPERATION` | 400 | Operation not allowed in current state |
| `RESOURCE_NOT_FOUND` | 404 | Resource doesn't exist |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists |
| `VALIDATION_FAILED` | 422 | Input validation failed |

### Messaging Errors (503)

| Code | Status | Description |
|------|--------|-------------|
| `CONNECTION_FAILED` | 503 | Cannot connect to broker |
| `PUBLISH_FAILED` | 503 | Failed to publish message |
| `SUBSCRIBE_FAILED` | 503 | Failed to subscribe to channel |
| `TIMEOUT` | 503 | Operation timed out |

### Database Errors (500)

| Code | Status | Description |
|------|--------|-------------|
| `OPERATION_FAILED` | 500 | Database operation failed |
| `CONNECTION_FAILED` | 500 | Database connection failed |
| `QUERY_TIMEOUT` | 500 | Query exceeded timeout |
| `DUPLICATE_KEY` | 500 | Unique constraint violation |

---

## Environment-Specific Behavior

### Development
- Stack traces included in error responses
- Detailed error messages
- All errors logged with full context

### Production
- Stack traces hidden
- Generic messages for internal errors
- Sensitive data sanitized
- Only operational errors show details

---

## Quick Reference

### Import Paths

```typescript
// Exceptions
import { BusinessException } from '@/core/exceptions/business.exception';
import { MessagingException } from '@/core/exceptions/messaging.exception';
import { DatabaseException } from '@/core/exceptions/database.exception';
import { ValidationException } from '@/core/exceptions/validation.exception';

// Utilities
import { ErrorHandler } from '@/core/common/utils/error-handler.util';

// Interfaces
import { ErrorResponse } from '@/core/interfaces/api-response.interface';
```

### Common Patterns

```typescript
// Resource not found
throw BusinessException.resourceNotFound('Resource', id);

// Invalid operation
throw BusinessException.invalidOperation('Message', details);

// Database operation
ErrorHandler.handleDatabaseOperation(op, type, collection, logger);

// Messaging operation
ErrorHandler.handleMessagingOperation(op, broker, type, logger);

// Async with logging
ErrorHandler.handleAsync(op, message, logger);
```

---

## See Also

- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Project organization
- [README.md](./README.md) - Getting started
- [CLAUDE.md](./CLAUDE.md) - AI assistant guide

**Last Updated:** 2025-11-01
