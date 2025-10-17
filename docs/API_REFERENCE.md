# API Reference

Complete API reference for all messaging patterns: WebSocket events, Redis Pub/Sub, NATS RPC, and RabbitMQ endpoints.

## Table of Contents

1. [WebSocket Events](#websocket-events)
2. [Redis Pub/Sub API](#redis-pubsub-api)
3. [NATS RPC API](#nats-rpc-api)
4. [RabbitMQ API](#rabbitmq-api)
5. [Error Codes](#error-codes)
6. [Authentication](#authentication)
7. [Rate Limiting](#rate-limiting)

---

## WebSocket Events

Base URL: `http://localhost:3000`

WebSocket connection is established at the root path `/` using Socket.IO protocol.

### Connection

#### Connect to WebSocket Server

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    username: 'YourUsername',
    token: 'optional-auth-token' // Optional for authenticated endpoints
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

**Authentication Parameters:**
- `username` (string, required): User's display name
- `token` (string, optional): JWT token for authenticated endpoints

---

### Client-to-Server Events

Events that clients emit to the server.

#### 1. `message` - Send Broadcast Message

Sends a message to all connected clients.

**Payload:**
```typescript
{
  message: string  // The message content (required)
}
```

**Response:**
```typescript
{
  userId: string        // Sender's socket ID
  username: string      // Sender's username
  message: string       // The message content
  timestamp: string     // ISO 8601 timestamp
}
```

**Example:**
```javascript
socket.emit('message',
  { message: 'Hello everyone!' },
  (response) => {
    console.log('Message sent:', response);
  }
);
```

**cURL equivalent (not applicable for WebSocket)**

---

#### 2. `privateMessage` - Send Private Message

Sends a private message to a specific user.

**Payload:**
```typescript
{
  targetId: string   // Target user's socket ID (required)
  message: string    // The message content (required)
}
```

**Response:**
```typescript
{
  sent: boolean      // Whether message was sent successfully
  to: string         // Target user's socket ID
}
```

**Example:**
```javascript
socket.emit('privateMessage',
  {
    targetId: 'xyz123',
    message: 'Private hello!'
  },
  (response) => {
    console.log('Private message sent:', response);
  }
);
```

---

#### 3. `joinRoom` - Join a Room

Join a specific room for group communication.

**Payload:**
```typescript
{
  room: string  // Room name (required)
}
```

**Response:**
```typescript
{
  room: string                          // Room name
  members: Array<{                      // Current members in the room
    id: string
    username: string
  }>
}
```

**Example:**
```javascript
socket.emit('joinRoom',
  { room: 'general' },
  (response) => {
    console.log('Joined room:', response);
  }
);
```

---

#### 4. `leaveRoom` - Leave a Room

Leave a room.

**Payload:**
```typescript
{
  room: string  // Room name (required)
}
```

**Response:**
```typescript
{
  left: string  // Room name that was left
}
```

**Example:**
```javascript
socket.emit('leaveRoom',
  { room: 'general' },
  (response) => {
    console.log('Left room:', response);
  }
);
```

---

#### 5. `roomMessage` - Send Room Message

Send a message to all members of a specific room.

**Payload:**
```typescript
{
  room: string     // Room name (required)
  message: string  // The message content (required)
}
```

**Response:**
```typescript
{
  userId: string        // Sender's socket ID
  username: string      // Sender's username
  room: string          // Room name
  message: string       // The message content
  timestamp: string     // ISO 8601 timestamp
}
```

**Example:**
```javascript
socket.emit('roomMessage',
  {
    room: 'general',
    message: 'Hello room!'
  },
  (response) => {
    console.log('Room message sent:', response);
  }
);
```

---

#### 6. `getOnlineUsers` - Get Online Users

Retrieve list of all connected users.

**Payload:** None

**Response:**
```typescript
{
  users: Array<{              // List of connected users
    id: string                // Socket ID
    username: string          // Username
    rooms: string[]           // Rooms user is in
  }>
  total: number               // Total number of users
}
```

**Example:**
```javascript
socket.emit('getOnlineUsers', (response) => {
  console.log('Online users:', response);
});
```

---

#### 7. `authenticatedMessage` - Send Authenticated Message

Send a message that requires authentication (protected by WsAuthGuard).

**Payload:**
```typescript
{
  message: string  // The message content (required)
}
```

**Authentication:** Requires valid `token` in connection auth.

**Response:**
```typescript
{
  message: string       // Confirmation message with username
  timestamp: string     // ISO 8601 timestamp
}
```

**Example:**
```javascript
// Connect with token
const socket = io('http://localhost:3000', {
  auth: {
    username: 'John',
    token: 'your-jwt-token'
  }
});

socket.emit('authenticatedMessage',
  { message: 'Secure message' },
  (response) => {
    console.log('Authenticated message sent:', response);
  }
);
```

---

### Server-to-Client Events

Events that the server emits to clients.

#### 1. `welcome` - Welcome Message

Received immediately after connecting.

**Payload:**
```typescript
{
  message: string           // Welcome message
  userId: string            // Your socket ID
  connectedUsers: number    // Total connected users
}
```

**Example:**
```javascript
socket.on('welcome', (data) => {
  console.log('Welcome:', data);
});
```

---

#### 2. `userConnected` - User Connected

Broadcast when a new user connects.

**Payload:**
```typescript
{
  userId: string        // New user's socket ID
  username: string      // New user's username
  totalUsers: number    // Total connected users
  timestamp: string     // ISO 8601 timestamp
}
```

**Example:**
```javascript
socket.on('userConnected', (data) => {
  console.log('User connected:', data);
});
```

---

#### 3. `userDisconnected` - User Disconnected

Broadcast when a user disconnects.

**Payload:**
```typescript
{
  userId: string        // Disconnected user's socket ID
  username: string      // Disconnected user's username
  totalUsers: number    // Remaining connected users
  timestamp: string     // ISO 8601 timestamp
}
```

**Example:**
```javascript
socket.on('userDisconnected', (data) => {
  console.log('User disconnected:', data);
});
```

---

#### 4. `message` - Broadcast Message

Received when any user sends a broadcast message.

**Payload:**
```typescript
{
  userId: string        // Sender's socket ID
  username: string      // Sender's username
  message: string       // The message content
  timestamp: string     // ISO 8601 timestamp
}
```

**Example:**
```javascript
socket.on('message', (data) => {
  console.log('New message:', data);
});
```

---

#### 5. `privateMessage` - Private Message

Received when someone sends you a private message.

**Payload:**
```typescript
{
  from: string              // Sender's socket ID
  fromUsername: string      // Sender's username
  message: string           // The message content
  timestamp: string         // ISO 8601 timestamp
}
```

**Example:**
```javascript
socket.on('privateMessage', (data) => {
  console.log('Private message from', data.fromUsername, ':', data.message);
});
```

---

#### 6. `userJoinedRoom` - User Joined Room

Broadcast to room members when someone joins.

**Payload:**
```typescript
{
  userId: string        // User's socket ID
  username: string      // User's username
  room: string          // Room name
  timestamp: string     // ISO 8601 timestamp
}
```

**Example:**
```javascript
socket.on('userJoinedRoom', (data) => {
  console.log(`${data.username} joined ${data.room}`);
});
```

---

#### 7. `userLeftRoom` - User Left Room

Broadcast to room members when someone leaves.

**Payload:**
```typescript
{
  userId: string        // User's socket ID
  username: string      // User's username
  room: string          // Room name
  timestamp: string     // ISO 8601 timestamp
}
```

**Example:**
```javascript
socket.on('userLeftRoom', (data) => {
  console.log(`${data.username} left ${data.room}`);
});
```

---

#### 8. `roomMessage` - Room Message

Received when someone sends a message to a room you're in.

**Payload:**
```typescript
{
  userId: string        // Sender's socket ID
  username: string      // Sender's username
  room: string          // Room name
  message: string       // The message content
  timestamp: string     // ISO 8601 timestamp
}
```

**Example:**
```javascript
socket.on('roomMessage', (data) => {
  console.log(`[${data.room}] ${data.username}: ${data.message}`);
});
```

---

### Connection Events

#### `connect`

Fired when successfully connected to the server.

```javascript
socket.on('connect', () => {
  console.log('Connected to server');
  console.log('Socket ID:', socket.id);
});
```

#### `disconnect`

Fired when disconnected from the server.

**Reason values:**
- `io server disconnect` - Server forcefully disconnected
- `io client disconnect` - Client manually disconnected
- `ping timeout` - Connection timeout
- `transport close` - Transport closed
- `transport error` - Transport error

```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

#### `connect_error`

Fired when connection fails.

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

#### `reconnect`

Fired when successfully reconnected.

```javascript
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});
```

---

## Redis Pub/Sub API

Base URL: `http://localhost:3000/redis-pubsub`

RESTful HTTP API with Server-Sent Events (SSE) for real-time updates.

### Endpoints

#### GET `/redis-pubsub`

Get pattern information and available endpoints.

**Response:**
```typescript
{
  pattern: string
  description: string
  status: 'connected' | 'disconnected'
  subscribedChannels: string[]
  endpoints: {
    publish: string
    subscribe: string
    unsubscribe: string
    stream: string
    status: string
  }
  examples: object
  practiceTasks: string[]
}
```

**cURL:**
```bash
curl http://localhost:3000/redis-pubsub
```

---

#### POST `/redis-pubsub/publish`

Publish a message to a Redis channel.

**Request Body:**
```typescript
{
  channel: string   // Channel name (required)
  message: string   // Message content (required)
}
```

**Response:**
```typescript
{
  success: boolean          // Operation success status
  channel: string           // Channel name
  message: string           // Message content
  subscriberCount: number   // Number of subscribers
  timestamp: string         // ISO 8601 timestamp
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/redis-pubsub/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "news",
    "message": "Breaking news!"
  }'
```

**Response Example:**
```json
{
  "success": true,
  "channel": "news",
  "message": "Breaking news!",
  "subscriberCount": 3,
  "timestamp": "2025-10-17T12:00:00.000Z"
}
```

---

#### POST `/redis-pubsub/subscribe`

Subscribe to a Redis channel.

**Request Body:**
```typescript
{
  channel: string   // Channel name (required)
}
```

**Response:**
```typescript
{
  success: boolean          // Operation success status
  channel: string           // Channel name
  message: string           // Confirmation message
  subscriberCount: number   // Number of subscribers
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/redis-pubsub/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "news"
  }'
```

**Response Example:**
```json
{
  "success": true,
  "channel": "news",
  "message": "Subscribed to channel: news",
  "subscriberCount": 1
}
```

---

#### POST `/redis-pubsub/unsubscribe/:channel`

Unsubscribe from a Redis channel.

**Path Parameters:**
- `channel` (string): Channel name to unsubscribe from

**Response:**
```typescript
{
  success: boolean   // Operation success status
  channel: string    // Channel name
  message: string    // Confirmation message
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/redis-pubsub/unsubscribe/news
```

**Response Example:**
```json
{
  "success": true,
  "channel": "news",
  "message": "Unsubscribed from channel: news"
}
```

---

#### GET `/redis-pubsub/stream` (SSE)

Stream real-time messages from a Redis channel using Server-Sent Events.

**Query Parameters:**
- `channel` (string, required): Channel name to stream from

**Response:** Server-Sent Events stream

**Event Data Format:**
```typescript
{
  channel: string       // Channel name
  message: string       // Message content
  timestamp: string     // ISO 8601 timestamp
}
```

**JavaScript Example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/redis-pubsub/stream?channel=news');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message from', data.channel, ':', data.message);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};

// Close connection
eventSource.close();
```

**cURL (stream to stdout):**
```bash
curl -N http://localhost:3000/redis-pubsub/stream?channel=news
```

---

#### GET `/redis-pubsub/status`

Get current status and subscribed channels.

**Response:**
```typescript
{
  connected: boolean              // Connection status
  subscribedChannels: string[]    // List of subscribed channels
  channelSubscribers: {           // Subscriber count per channel
    [channel: string]: number
  }
}
```

**cURL:**
```bash
curl http://localhost:3000/redis-pubsub/status
```

**Response Example:**
```json
{
  "connected": true,
  "subscribedChannels": ["news", "events"],
  "channelSubscribers": {
    "news": 3,
    "events": 1
  }
}
```

---

## NATS RPC API

Base URL: `http://localhost:3000/nats-rpc`

Request/Response pattern for microservices communication.

### Endpoints

#### GET `/nats-rpc`

Get pattern information and available endpoints.

**Response:**
```typescript
{
  pattern: string
  description: string
  status: 'connected' | 'disconnected'
  endpoints: {
    request: string
    publish: string
    status: string
  }
}
```

**cURL:**
```bash
curl http://localhost:3000/nats-rpc
```

---

#### POST `/nats-rpc/request`

Send a request and wait for response (RPC pattern).

**Request Body:**
```typescript
{
  subject: string   // Subject name (required)
  data: string      // Request data (required)
}
```

**Response:**
```typescript
{
  success: boolean   // Operation success status
  response: string   // Response from the handler
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/nats-rpc/request \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "greet",
    "data": "World"
  }'
```

**Response Example:**
```json
{
  "success": true,
  "response": "Hello, World!"
}
```

**Available Subjects:**
- `greet` - Returns greeting message
- Add more subjects in your NATS service

---

#### POST `/nats-rpc/publish`

Publish a message to a subject (fire and forget).

**Request Body:**
```typescript
{
  subject: string   // Subject name (required)
  data: string      // Message data (required)
}
```

**Response:**
```typescript
{
  success: boolean   // Operation success status
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/nats-rpc/publish \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "events",
    "data": "User logged in"
  }'
```

**Response Example:**
```json
{
  "success": true
}
```

---

#### GET `/nats-rpc/status`

Get connection status.

**Response:**
```typescript
{
  connected: boolean   // Connection status
}
```

**cURL:**
```bash
curl http://localhost:3000/nats-rpc/status
```

**Response Example:**
```json
{
  "connected": true
}
```

---

## RabbitMQ API

Base URL: `http://localhost:3000/rabbitmq`

Background job processing with message queues.

### Endpoints

#### GET `/rabbitmq`

Get pattern information and available endpoints.

**Response:**
```typescript
{
  pattern: string
  description: string
  status: 'connected' | 'disconnected'
  endpoints: {
    send: string
    status: string
  }
}
```

**cURL:**
```bash
curl http://localhost:3000/rabbitmq
```

---

#### POST `/rabbitmq/send`

Send a job to a message queue.

**Request Body:**
```typescript
{
  queue: string     // Queue name (required)
  message: string   // Job message (required)
}
```

**Response:**
```typescript
{
  success: boolean   // Operation success status
  queue: string      // Queue name
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/rabbitmq/send \
  -H "Content-Type: application/json" \
  -d '{
    "queue": "tasks",
    "message": "Process order #12345"
  }'
```

**Response Example:**
```json
{
  "success": true,
  "queue": "tasks"
}
```

**Common Queue Names:**
- `tasks` - General background tasks
- `emails` - Email sending jobs
- `notifications` - Push notifications
- Custom queue names as needed

---

#### GET `/rabbitmq/status`

Get connection status.

**Response:**
```typescript
{
  connected: boolean   // Connection status
}
```

**cURL:**
```bash
curl http://localhost:3000/rabbitmq/status
```

**Response Example:**
```json
{
  "connected": true
}
```

---

## Error Codes

### HTTP Error Codes

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### WebSocket Error Responses

WebSocket events may return error objects:

```typescript
{
  error: string      // Error message
  code?: string      // Error code (optional)
}
```

**Common WebSocket Errors:**
- `INVALID_PARAMETERS` - Missing or invalid parameters
- `NOT_FOUND` - Resource (room, user) not found
- `UNAUTHORIZED` - Authentication required
- `RATE_LIMIT_EXCEEDED` - Too many requests

### Redis Pub/Sub Errors

```typescript
{
  statusCode: number
  message: string
  error: string
}
```

**Common Errors:**
- `400` - Invalid channel name or message
- `503` - Redis connection unavailable

### NATS RPC Errors

```typescript
{
  statusCode: number
  message: string
  error: string
}
```

**Common Errors:**
- `400` - Invalid subject or data
- `503` - NATS connection unavailable
- `504` - Request timeout (no response received)

### RabbitMQ Errors

```typescript
{
  statusCode: number
  message: string
  error: string
}
```

**Common Errors:**
- `400` - Invalid queue name or message
- `503` - RabbitMQ connection unavailable

---

## Authentication

### WebSocket Authentication

WebSocket connections support authentication via the `auth` object:

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    username: 'JohnDoe',       // Required
    token: 'your-jwt-token'    // Optional for protected events
  }
});
```

**Protected Events:**
- `authenticatedMessage` - Requires valid JWT token

**Token Format:**
JWT token with the following payload:
```typescript
{
  username: string
  userId: string
  iat: number      // Issued at
  exp: number      // Expiration
}
```

### HTTP API Authentication

Currently, HTTP endpoints (Redis, NATS, RabbitMQ) do not require authentication in development mode.

**For Production:**

Add authentication headers:

```bash
curl -X POST http://localhost:3000/redis-pubsub/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"channel":"news","message":"Hello"}'
```

**Recommended Headers:**
- `Authorization: Bearer <token>` - JWT authentication
- `X-API-Key: <key>` - API key authentication

---

## Rate Limiting

### Default Limits

| Pattern | Endpoint | Limit | Window |
|---------|----------|-------|--------|
| WebSocket | All events | 100 messages | 1 minute |
| Redis Pub/Sub | Publish | 50 requests | 1 minute |
| Redis Pub/Sub | Subscribe | 10 requests | 1 minute |
| NATS RPC | Request | 100 requests | 1 minute |
| NATS RPC | Publish | 200 requests | 1 minute |
| RabbitMQ | Send | 100 requests | 1 minute |

### Rate Limit Headers

When rate limited, responses include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1634567890
Retry-After: 60
```

### Rate Limit Error Response

```typescript
{
  statusCode: 429,
  message: "Too Many Requests",
  error: "Rate limit exceeded. Please try again later.",
  retryAfter: 60  // Seconds until rate limit resets
}
```

### Handling Rate Limits

**Client-side implementation:**

```typescript
async function sendMessageWithRetry(message: string, retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await publish('channel', message);
      return;
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
        console.log(`Rate limited. Retrying in ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Testing Examples

### WebSocket Testing

```javascript
// Test script
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { username: 'TestUser' }
});

socket.on('connect', async () => {
  console.log('Connected');

  // Test broadcast message
  socket.emit('message', { message: 'Test' }, (response) => {
    console.log('Message response:', response);
  });

  // Test joining room
  socket.emit('joinRoom', { room: 'test' }, (response) => {
    console.log('Join room response:', response);
  });

  // Test room message
  socket.emit('roomMessage', { room: 'test', message: 'Hello room' }, (response) => {
    console.log('Room message response:', response);
  });
});
```

### Redis Pub/Sub Testing

```bash
# Terminal 1 - Subscribe
curl -N http://localhost:3000/redis-pubsub/stream?channel=test

# Terminal 2 - Subscribe via POST
curl -X POST http://localhost:3000/redis-pubsub/subscribe \
  -H "Content-Type: application/json" \
  -d '{"channel":"test"}'

# Terminal 3 - Publish
curl -X POST http://localhost:3000/redis-pubsub/publish \
  -H "Content-Type: application/json" \
  -d '{"channel":"test","message":"Hello Redis"}'
```

### NATS RPC Testing

```bash
# Test request
curl -X POST http://localhost:3000/nats-rpc/request \
  -H "Content-Type: application/json" \
  -d '{"subject":"greet","data":"World"}'

# Test publish
curl -X POST http://localhost:3000/nats-rpc/publish \
  -H "Content-Type: application/json" \
  -d '{"subject":"events","data":"test event"}'
```

### RabbitMQ Testing

```bash
# Send job
curl -X POST http://localhost:3000/rabbitmq/send \
  -H "Content-Type: application/json" \
  -d '{"queue":"tasks","message":"Test job"}'

# Check status
curl http://localhost:3000/rabbitmq/status
```

---

## Best Practices

1. **Always handle errors** - Check for error responses in callbacks
2. **Implement timeouts** - Don't wait indefinitely for responses
3. **Use acknowledgments** - Always provide callbacks for WebSocket events
4. **Validate input** - Sanitize all user input before sending
5. **Monitor rate limits** - Implement backoff strategies
6. **Close connections** - Clean up WebSocket and SSE connections when done
7. **Handle reconnections** - Implement automatic reconnection logic
8. **Log errors** - Track all errors for debugging
9. **Use TypeScript** - Leverage type safety for payloads
10. **Test edge cases** - Test with invalid data, disconnections, etc.

---

## Changelog

### Version 1.0.0 (Current)
- Initial API release
- WebSocket events for real-time communication
- Redis Pub/Sub with SSE streaming
- NATS RPC request/response
- RabbitMQ job queuing
- Rate limiting on all endpoints
- Error handling and status codes

---

## Support

For issues, questions, or feature requests:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Documentation: [README.md](../README.md)
- Examples: [Frontend Integration Guide](./FRONTEND_INTEGRATION.md)
