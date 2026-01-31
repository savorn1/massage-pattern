# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **NestJS educational project** demonstrating 5 essential messaging patterns for modern distributed applications:
- **WebSocket** - Real-time bidirectional communication (Socket.IO)
- **Redis Pub/Sub** - Distributed event broadcasting and horizontal scaling
- **NATS RPC** - Lightweight request/response microservices communication
- **RabbitMQ** - Reliable background job processing and task queues
- **MongoDB** - Document database for persistent message storage and retrieval

## Development Commands

```bash
# Start development server with hot-reload
npm run start:dev

# Build for production
npm run build

# Start production build
npm run start:prod

# Linting (with auto-fix)
npm run lint

# Code formatting
npm run format

# Run tests
npm run test
npm run test:watch      # Watch mode
npm run test:cov        # With coverage
npm run test:e2e        # E2E tests

# Start message brokers and database (Redis, NATS, RabbitMQ, MongoDB)
docker-compose up -d

# Stop all services
docker-compose down

# View service logs
docker-compose logs -f [service]  # service: redis, nats, rabbitmq, mongodb
```

## Project Architecture

### Module Structure

The application follows NestJS modular architecture with 6 feature modules:

```
src/
├── app.module.ts           # Root module - imports all features + ConfigModule + MongooseModule
├── main.ts                 # Bootstrap (port 3000, CORS, ValidationPipe, static assets)
├── websocket/              # WebSocket pattern (Socket.IO gateway)
├── redis-pubsub/           # Redis Pub/Sub pattern (service + REST/SSE controller)
├── nats-rpc/               # NATS RPC pattern (service + REST controller)
├── rabbitmq/               # RabbitMQ pattern (service + REST controller)
├── mongodb/                # MongoDB pattern (service + REST controller + schemas)
└── final-project/          # Integration module (placeholder for combined patterns)
```

Each messaging pattern module is **self-contained** with:
- **Service** - Manages broker connection and messaging logic
- **Controller/Gateway** - REST endpoints or WebSocket gateway
- **DTOs** - Request/response validation with `class-validator`
- **Module** - NestJS module definition

### Key Architecture Patterns

1. **Lifecycle Management**: All services implement `OnModuleInit` (connect) and `OnModuleDestroy` (disconnect) for proper resource cleanup
2. **Singleton Services**: Each service maintains a single connection to its broker
3. **Connection Tracking**: WebSocket gateway uses `Map<clientId, {username, rooms}>` to track active connections
4. **Validation**: Global `ValidationPipe` validates all DTOs using `class-validator` decorators

### WebSocket Pattern Details

- **Gateway**: [src/websocket/websocket.gateway.ts](src/websocket/websocket.gateway.ts)
- **Authentication**: `WsAuthGuard` validates tokens from socket handshake (demo: "secret-token")
- **Connection Map**: Stores `{ username, rooms: Set<string> }` per socket
- **Events**:
  - `message` - Broadcast to all clients
  - `privateMessage` - Direct message to specific username
  - `roomMessage` - Message to all users in a room
  - `joinRoom` / `leaveRoom` - Room management
  - `getOnlineUsers` - List connected users
  - `authenticatedMessage` - Requires valid token (uses guard)
- **Test Client**: [http://localhost:3000/websocket-client.html](public/websocket-client.html)

### Redis Pub/Sub Pattern Details

- **Service**: [src/redis-pubsub/redis-pubsub.service.ts](src/redis-pubsub/redis-pubsub.service.ts)
- **Architecture**: Separate Redis clients for publisher and subscriber (required by Redis)
- **Local Subscribers**: `Map<channel, Set<callbacks>>` manages multiple listeners per channel
- **Connection Retry**: Exponential backoff up to 2 seconds on connection failure
- **SSE Integration**: `/redis-pubsub/stream?channel=X` provides Server-Sent Events stream
- **Key Methods**:
  - `publish(channel, message)` - Broadcast to channel
  - `subscribe(channel, callback)` - Register callback for channel messages
  - `unsubscribe(channel, callback)` - Remove specific callback
- **Testing**: Use `docker exec -it <container> redis-cli` to publish/subscribe directly

### NATS RPC Pattern Details

- **Service**: [src/nats-rpc/nats-rpc.service.ts](src/nats-rpc/nats-rpc.service.ts)
- **String Codec**: Uses NATS `StringCodec` for message encoding/decoding
- **Request Timeout**: 5 seconds default for RPC calls
- **Key Methods**:
  - `request(subject, data)` - RPC call, waits for response with timeout
  - `publish(subject, data)` - Fire-and-forget publish
- **Monitoring**: NATS server metrics at [http://localhost:8222](http://localhost:8222)

### RabbitMQ Pattern Details

- **Service**: [src/rabbitmq/rabbitmq.service.ts](src/rabbitmq/rabbitmq.service.ts)
- **Queue Properties**: Durable queues with persistent messages
- **Acknowledgment**: Auto-acknowledge mode (messages auto-acked on processing)
- **Key Methods**:
  - `sendToQueue(queue, message)` - Send job to queue
  - `consume(queue, callback)` - Start consuming with auto-ack
- **Management UI**: [http://localhost:15672](http://localhost:15672) (guest/guest)

### MongoDB Pattern Details

- **Service**: [src/mongodb/mongodb.service.ts](src/mongodb/mongodb.service.ts)
- **Schema**: Message document with timestamps (createdAt, updatedAt)
- **Schema Fields**:
  - `content` (required) - Message text content
  - `sender` (required) - Username of sender
  - `recipient` (optional) - Direct message recipient
  - `channel` (optional) - Channel/room name for group messages
  - `type` (default: 'text') - Message type (text, image, file, etc.)
  - `metadata` (optional) - Additional custom data as object
  - `isRead` (default: false) - Read status flag
- **Key Methods**:
  - `create(dto)` - Create new message
  - `findAll(query)` - Find messages with filtering and pagination
  - `findOne(id)` - Get single message by ID
  - `update(id, dto)` - Update message
  - `delete(id)` - Delete message
  - `markAsRead(id)` - Mark message as read
  - `getUnreadMessages(recipient)` - Get unread messages for user
  - `getConversation(user1, user2, limit)` - Get conversation between two users
  - `getChannelMessages(channel, limit)` - Get messages in a channel
  - `count(query)` - Count messages with filters
- **DTOs**:
  - `CreateMessageDto` - Validates message creation
  - `UpdateMessageDto` - Validates partial updates (all fields optional)
  - `QueryMessageDto` - Filters for searching (sender, recipient, channel, type, isRead) with pagination
- **REST Endpoints**:
  - `POST /mongodb/messages` - Create message
  - `GET /mongodb/messages?sender=alice&limit=50` - List with filters
  - `GET /mongodb/messages/:id` - Get by ID
  - `PUT /mongodb/messages/:id` - Update message
  - `DELETE /mongodb/messages/:id` - Delete message
  - `PUT /mongodb/messages/:id/read` - Mark as read
  - `GET /mongodb/messages/unread/:recipient` - Get unread messages
  - `GET /mongodb/conversations/:user1/:user2?limit=50` - Get conversation
  - `GET /mongodb/channels/:channel?limit=100` - Get channel messages
  - `GET /mongodb/messages/count` - Count messages
  - `DELETE /mongodb/messages` - Delete all (use with caution)
  - `GET /mongodb/health` - Health check
- **Database**: MongoDB 7 with authentication enabled (admin/password)
- **Connection**: Mongoose ODM with automatic reconnection

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
PORT=3000                           # Server port
REDIS_HOST=localhost                # Redis host
REDIS_PORT=6379                     # Redis port
NATS_URL=nats://localhost:4222      # NATS connection URL
RABBITMQ_URL=amqp://localhost:5672  # RabbitMQ connection URL
MONGODB_URI=mongodb://admin:password@localhost:27017/messaging-patterns?authSource=admin
```

All services read configuration directly from `process.env` with sensible defaults.

### Docker Compose Services

The `docker-compose.yml` defines 4 services with health checks:
- **Redis** (port 6379) - In-memory data store with persistence volume
- **NATS** (ports 4222, 8222) - NATS server with HTTP monitoring
- **RabbitMQ** (ports 5672, 15672) - RabbitMQ with management plugin
- **MongoDB** (port 27017) - Document database with persistence volume and authentication

All services include health checks and will auto-restart on failure.

## Static Assets & Documentation

The application serves static content from two directories:
- `/public/*` → Root path (WebSocket test client at `/websocket-client.html`)
- `/docs/*` → Documentation path (interactive HTML docs at `/docs/index.html`)

**Interactive Documentation**:
- [http://localhost:3000/docs/index.html](http://localhost:3000/docs/index.html) - Main docs homepage
- [http://localhost:3000/docs/api-reference.html](http://localhost:3000/docs/api-reference.html) - Complete API reference
- [http://localhost:3000/docs/frontend-integration.html](http://localhost:3000/docs/frontend-integration.html) - React/Vue/Angular examples
- [http://localhost:3000/docs/deployment.html](http://localhost:3000/docs/deployment.html) - Production deployment guide

**Markdown Documentation**: Available in `docs/` directory (FRONTEND_INTEGRATION.md, API_REFERENCE.md, DEPLOYMENT.md)

## Testing Each Pattern

### WebSocket
1. Open [http://localhost:3000/websocket-client.html](http://localhost:3000/websocket-client.html)
2. Connect with username in multiple browser tabs
3. Test broadcast, private messages, rooms, authentication

### Redis Pub/Sub
```bash
# Publish message
curl -X POST http://localhost:3000/redis-pubsub/publish \ -H "Content-Type: application/json" \ -d '{"channel":"news","message":"Hello Redis!"}'

# Subscribe via SSE
curl -N http://localhost:3000/redis-pubsub/stream?channel=news

# Test with Redis CLI
docker exec -it messaging-patterns-redis-1 redis-cli
> PUBLISH news "Direct from CLI"
```

### NATS RPC
```bash
# Make RPC request
curl -X POST http://localhost:3000/nats-rpc/request \
  -H "Content-Type: application/json" \
  -d '{"subject":"greet","data":"World"}'

# Publish to subject
curl -X POST http://localhost:3000/nats-rpc/publish \
  -H "Content-Type: application/json" \
  -d '{"subject":"events","data":"User logged in"}'
```

### RabbitMQ
```bash
# Send job to queue
curl -X POST http://localhost:3000/rabbitmq/send \
  -H "Content-Type: application/json" \
  -d '{"queue":"tasks","message":"Process this job"}'

# Monitor in UI: http://localhost:15672 (guest/guest)
```

### MongoDB
```bash
# Create a message
curl -X POST http://localhost:3000/mongodb/messages \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello MongoDB!","sender":"alice","recipient":"bob"}'

# Get all messages with filters
curl "http://localhost:3000/mongodb/messages?sender=alice&limit=10"

# Get a specific message by ID
curl http://localhost:3000/mongodb/messages/507f1f77bcf86cd799439011

# Update a message
curl -X PUT http://localhost:3000/mongodb/messages/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{"content":"Updated message"}'

# Mark message as read
curl -X PUT http://localhost:3000/mongodb/messages/507f1f77bcf86cd799439011/read

# Get unread messages for a user
curl http://localhost:3000/mongodb/messages/unread/bob

# Get conversation between two users
curl "http://localhost:3000/mongodb/conversations/alice/bob?limit=50"

# Get channel messages
curl "http://localhost:3000/mongodb/channels/general?limit=100"

# Delete a message
curl -X DELETE http://localhost:3000/mongodb/messages/507f1f77bcf86cd799439011

# Access MongoDB directly
docker exec -it messaging-patterns-mongodb-1 mongosh -u admin -p password --authenticationDatabase admin
> use messaging-patterns
> db.messages.find().limit(10)
```

## Code Patterns & Conventions

### Adding a New Messaging Pattern

1. Create module directory: `src/new-pattern/`
2. Implement service with lifecycle hooks:
   ```typescript
   @Injectable()
   export class NewPatternService implements OnModuleInit, OnModuleDestroy {
     async onModuleInit() { /* connect */ }
     async onModuleDestroy() { /* disconnect */ }
   }
   ```
3. Create controller/gateway for endpoints
4. Define DTOs with validation decorators (`@IsString()`, `@IsNotEmpty()`, etc.)
5. Create module and import in `app.module.ts`

### DTO Validation Pattern

All DTOs use `class-validator` decorators:
```typescript
export class ExampleDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  optionalField?: string;
}
```

### Connection Error Handling

Services should implement retry logic with exponential backoff:
```typescript
// Example from Redis service
client.on('error', (err) => {
  console.error('Redis connection error:', err);
  // Implement exponential backoff retry
});
```

### WebSocket Event Handler Pattern

```typescript
@SubscribeMessage('eventName')
handleEvent(
  @MessageBody() data: DataDto,
  @ConnectedSocket() client: Socket,
): void {
  // Process event
  // Emit response: client.emit('response', data)
  // Or broadcast: this.server.emit('broadcast', data)
}
```

## Troubleshooting

### Broker Connection Issues

```bash
# Check if all containers are running
docker ps

# View logs for specific service
docker-compose logs -f redis
docker-compose logs -f nats
docker-compose logs -f rabbitmq
docker-compose logs -f mongodb

# Restart a specific service
docker-compose restart redis

# Check connection status via REST endpoints
curl http://localhost:3000/redis-pubsub/status
curl http://localhost:3000/nats-rpc/status
curl http://localhost:3000/rabbitmq/status
curl http://localhost:3000/mongodb/health
```

### WebSocket Connection Issues

1. Check CORS is enabled in `main.ts` (it is by default)
2. Verify WebSocket client connects to correct port (3000)
3. Check browser console for connection errors
4. Ensure Socket.IO versions match between client and server

### Port Conflicts

If ports 3000, 4222, 5672, 6379, 8222, 15672, or 27017 are in use:
1. Stop conflicting services
2. Or modify ports in `docker-compose.yml` and `.env`
3. Update client URLs accordingly

## Learning Path Recommendation

1. **Start with WebSocket** - Most visual with interactive HTML client
2. **MongoDB** - Understand document storage and CRUD operations with persistent message history
3. **Redis Pub/Sub** - Explore distributed messaging and SSE for real-time events
4. **NATS RPC** - Learn request/response patterns for microservices
5. **RabbitMQ** - Master reliable job queues and message persistence for background tasks
6. **Final Project** - Combine all patterns in a real-world scenario

## Important Notes

- The project uses **NestJS v11** with updated dependency injection patterns
- **Socket.IO v4** is used for WebSocket implementation (not native WebSockets)
- **ioredis v5** is the Redis client (not node-redis)
- **NATS v2** uses the modern JetStream-capable client
- **amqplib v0.10** handles RabbitMQ connections
- **Mongoose v8** with **@nestjs/mongoose** provides MongoDB ODM integration
- All patterns are **production-ready** with proper error handling and lifecycle management
- Authentication in `WsAuthGuard` is simplified for demo purposes (uses "secret-token")
- MongoDB schema includes automatic timestamps (createdAt, updatedAt) via Mongoose
- The `final-project` module is a placeholder for combining all patterns
