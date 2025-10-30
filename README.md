# 🚀 NestJS Messaging Patterns - Complete Learning Project

A comprehensive hands-on learning project covering **4 essential messaging patterns** in NestJS with real-world examples, test clients, and practice tasks.

## 🆕 NEW: Live Interactive Examples!

### 🎨 Interactive Test Dashboard
Open in your browser: **[http://localhost:3000/examples-test.html](http://localhost:3000/examples-test.html)**

Beautiful web interface to test all messaging patterns with one click!

### 🔧 Command Line Testing
Try the new `/examples` endpoints to see **NATS, RabbitMQ, and Redis working together** in real-world scenarios:

```bash
# Quick test (after starting the app)
curl -X POST http://localhost:3000/examples/setup
curl -X POST http://localhost:3000/examples/combined?email=test@example.com
```

📖 **[View Examples Guide →](./EXAMPLES_GUIDE.md)** | **[How They Work →](./HOW_THEY_WORK.md)**

## 📚 What You'll Learn

### 1. **WebSocket Pattern** - Real-time Bidirectional Communication
- ✅ Connection management
- ✅ Room-based messaging
- ✅ Authentication with guards
- ✅ Private messaging
- ✅ Broadcast messaging
- ✅ Interactive HTML test client included

### 2. **Redis Pub/Sub Pattern** - Horizontal Scaling
- ✅ Publisher/Subscriber architecture
- ✅ Channel-based messaging
- ✅ Server-Sent Events (SSE) integration
- ✅ Test with Redis CLI
- ✅ Understand distributed messaging

### 3. **NATS RPC Pattern** - Request/Response Communication
- ✅ Remote Procedure Call (RPC) setup
- ✅ Request-response pattern
- ✅ Queue groups for load balancing
- ✅ Test with NATS CLI
- ✅ Lightweight microservices communication

### 4. **RabbitMQ Pattern** - Background Job Processing
- ✅ Producer/Consumer (worker) pattern
- ✅ Message acknowledgments
- ✅ Durable queues
- ✅ Management UI included
- ✅ Reliable job processing

## 🎯 Quick Start

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose
- npm or yarn

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Start message brokers (Redis, NATS, RabbitMQ)
docker-compose up -d

# 3. Copy environment file
cp .env.example .env

# 4. Start the application
npm run start:dev
```

The server will start on `http://localhost:3000`

## 📖 Documentation

This project includes comprehensive documentation in multiple formats:

### Interactive HTML Documentation
- **[Main Documentation](http://localhost:3000/docs/index.html)** - Beautiful interactive homepage
- **[API Reference](http://localhost:3000/docs/api-reference.html)** - Complete API documentation
- **[Frontend Integration](http://localhost:3000/docs/frontend-integration.html)** - React, Vue, Angular examples
- **[Deployment Guide](http://localhost:3000/docs/deployment.html)** - Production deployment

### Markdown Documentation
- [Frontend Integration Guide](docs/FRONTEND_INTEGRATION.md) - Integration for all frameworks
- [API Reference](docs/API_REFERENCE.md) - Complete API specs
- [Deployment Guide](docs/DEPLOYMENT.md) - Docker, Kubernetes, Production

> 💡 **Tip:** After starting the application, visit [http://localhost:3000/docs/](http://localhost:3000/docs/index.html) for the full interactive documentation experience.

## 🧪 Testing Each Pattern

### WebSocket Pattern
1. Open the interactive test client: `http://localhost:3000/websocket-client.html`
2. Connect with different usernames in multiple browser tabs
3. Test features:
   - Broadcast messages to all users
   - Join/leave rooms
   - Send room-specific messages
   - Send private messages
   - Test authentication

### Redis Pub/Sub Pattern
```bash
# View pattern info
curl http://localhost:3000/redis-pubsub

# Publish a message
curl -X POST http://localhost:3000/redis-pubsub/publish \
  -H "Content-Type: application/json" \
  -d '{"channel":"news","message":"Hello Redis!"}'

# Subscribe to a channel
curl -X POST http://localhost:3000/redis-pubsub/subscribe \
  -H "Content-Type: application/json" \
  -d '{"channel":"news"}'

# Test with Redis CLI
docker exec -it messaging-patterns-redis-1 redis-cli
> PUBLISH news "Test message"
> SUBSCRIBE news
```

### NATS RPC Pattern
```bash
# View pattern info
curl http://localhost:3000/nats-rpc

# Send RPC request
curl -X POST http://localhost:3000/nats-rpc/request \
  -H "Content-Type: application/json" \
  -d '{"subject":"greet","data":"World"}'

# Publish to subject
curl -X POST http://localhost:3000/nats-rpc/publish \
  -H "Content-Type: application/json" \
  -d '{"subject":"events","data":"User logged in"}'
```

### RabbitMQ Pattern
```bash
# View pattern info
curl http://localhost:3000/rabbitmq

# Send job to queue
curl -X POST http://localhost:3000/rabbitmq/send \
  -H "Content-Type: application/json" \
  -d '{"queue":"tasks","message":"Process this job"}'

# Access RabbitMQ Management UI
open http://localhost:15672
# Login: guest / guest
```

## 📊 Management UIs

- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **NATS Monitoring**: http://localhost:8222

## 🎓 Practice Tasks

### WebSocket
- [ ] Connect 3+ clients simultaneously
- [ ] Create multiple rooms and test isolation
- [ ] Implement private messaging between users
- [ ] Test authentication with valid/invalid tokens
- [ ] Monitor connection/disconnection events

### Redis Pub/Sub
- [ ] Publish to multiple channels
- [ ] Subscribe to multiple channels
- [ ] Run multiple server instances (horizontal scaling test)
- [ ] Test with Redis CLI commands
- [ ] Measure message delivery time

### NATS RPC
- [ ] Create request-response pairs
- [ ] Test timeout scenarios
- [ ] Implement queue groups
- [ ] Benchmark request latency
- [ ] Test with NATS CLI

### RabbitMQ
- [ ] Send 100+ jobs to queue
- [ ] Monitor job processing in UI
- [ ] Test message acknowledgment
- [ ] Simulate worker failures
- [ ] Test durable queues (restart broker)

## 📁 Project Structure

```
src/
├── websocket/              # WebSocket pattern implementation
│   ├── websocket.gateway.ts
│   ├── auth.guard.ts
│   └── dto/
├── redis-pubsub/          # Redis Pub/Sub pattern
│   ├── redis-pubsub.service.ts
│   ├── redis-pubsub.controller.ts
│   └── dto/
├── nats-rpc/              # NATS RPC pattern
│   ├── nats-rpc.service.ts
│   └── nats-rpc.controller.ts
├── rabbitmq/              # RabbitMQ pattern
│   ├── rabbitmq.service.ts
│   └── rabbitmq.controller.ts
└── final-project/         # Combined patterns project
public/
└── websocket-client.html  # Interactive WebSocket test client
```

## 🔍 Pattern Comparison

| Pattern | Use Case | Pros | Cons |
|---------|----------|------|------|
| **WebSocket** | Real-time chat, live updates | Bidirectional, low latency | Doesn't scale horizontally |
| **Redis Pub/Sub** | Event broadcasting, caching | Fast, simple, scalable | Fire-and-forget, no persistence |
| **NATS RPC** | Microservices RPC | Lightweight, fast | Requires NATS server |
| **RabbitMQ** | Background jobs, tasks | Reliable, persistent | More complex setup |

## 🛠️ Development Commands

```bash
# Start development server
npm run start:dev

# Build project
npm run build

# Run linting
npm run lint

# Format code
npm run format

# Start message brokers
docker-compose up -d

# Stop message brokers
docker-compose down

# View broker logs
docker-compose logs -f
```

## 📖 API Documentation

Visit `http://localhost:3000` for a complete list of available endpoints for each pattern.

## 🐛 Troubleshooting

### Redis connection failed
```bash
# Check if Redis is running
docker ps | grep redis

# Restart Redis
docker-compose restart redis
```

### NATS connection failed
```bash
# Check NATS status
docker ps | grep nats

# View NATS logs
docker-compose logs nats
```

### RabbitMQ connection failed
```bash
# Check RabbitMQ status
docker ps | grep rabbitmq

# Wait for RabbitMQ to be ready
docker-compose logs -f rabbitmq
```

## 🎯 Learning Path

1. **Start with WebSocket** - Most visual and interactive
2. **Move to Redis Pub/Sub** - Learn distributed messaging
3. **Try NATS RPC** - Understand request-response patterns
4. **End with RabbitMQ** - Master reliable job queues

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Redis Pub/Sub Guide](https://redis.io/topics/pubsub)
- [NATS Documentation](https://docs.nats.io/)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/getstarted.html)

## 📝 License

MIT
