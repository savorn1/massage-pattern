# Messaging Patterns - Live Examples

This module demonstrates **real-world usage** of NATS, RabbitMQ, and Redis messaging patterns with practical examples.

## 🚀 Quick Start

### 1. Start the Application

```bash
# Start message brokers
docker-compose up -d

# Start the NestJS app
npm run start:dev
```

### 2. Setup Workers & Subscribers

First, activate the background workers and event subscribers:

```bash
curl -X POST http://localhost:3000/examples/setup
```

**What this does:**
- ✅ Starts 5 RabbitMQ workers (emails, image-processing, reports, analytics, notifications)
- ✅ Starts 4 Redis subscribers (user-events, system-alerts, cache-invalidation, user-activity)
- Watch your console logs to see them activate!

### 3. Try the Examples

## Example 1: RabbitMQ Job Queue

Send background jobs to workers:

```bash
curl -X POST http://localhost:3000/examples/rabbitmq
```

**What happens:**
```
Your Terminal                    RabbitMQ Queue              Workers (Console)
     |                                |                           |
     |--[Send 3 jobs]--------------->|                           |
     |                                |                           |
     |                                |--[Email job]------------->| [Email Worker] Processing...
     |                                |                           | [Email Worker] ✓ Email sent!
     |                                |                           |
     |                                |--[Image job]------------->| [Image Worker] Processing...
     |                                |                           | [Image Worker] ✓ Image processed!
     |                                |                           |
     |                                |--[Report job]------------>| [Report Worker] Processing...
     |                                |                           | [Report Worker] ✓ Report generated!
```

**Real-world use cases:**
- 📧 Send welcome emails after user registration
- 🖼️ Process uploaded images (resize, compress)
- 📊 Generate monthly reports
- 🔔 Send push notifications

---

## Example 2: Redis Pub/Sub

Broadcast events to all subscribers:

```bash
curl -X POST http://localhost:3000/examples/redis
```

**What happens:**
```
Your Terminal                Redis Server                Subscribers (Console)
     |                            |                              |
     |--[Publish to channel]---->|                              |
     |                            |--[Broadcast]---------------->| [User Events] User logged in
     |                            |--[Broadcast]---------------->| [Alert System] 🚨 High CPU!
     |                            |--[Broadcast]---------------->| [Cache Manager] Invalidating...
```

**Real-world use cases:**
- 🔄 Cache invalidation across multiple servers
- 📢 Notify all services about user activity
- 🚨 System-wide alerts and notifications
- 📊 Live updates (scores, prices, status)

---

## Example 3: NATS Request/Response

Call a microservice and wait for response:

```bash
curl -X POST http://localhost:3000/examples/nats
```

**What happens:**
```
Your Service              NATS Server              Other Microservice
     |                         |                            |
     |--[Request: Get user]--->|                            |
     |                         |--[Route request]---------->|
     |                         |                            | (Processing...)
     |                         |<--[Response: User data]----|
     |<--[Return response]-----|                            |
```

**Note:** This example requires a NATS responder service to be running. By default, it will timeout since no responder is available.

**Real-world use cases:**
- 🔐 Call authentication service
- 💳 Request payment processing
- 📦 Check inventory availability
- 👤 Fetch user profile data

---

## Example 4: Combined - User Registration Flow

See all three messaging patterns working together:

```bash
curl -X POST "http://localhost:3000/examples/combined?email=alice@example.com"
```

**What happens:**

```
User Registration Request
          |
          |
    [Step 1: NATS RPC]
          |
          |---> Call Billing Service (create account)
          |     Response: billingId = "bill-123"
          |
    [Step 2: RabbitMQ]
          |
          |---> Queue job: Send welcome email
          |---> Queue job: Track signup event (analytics)
          |---> Queue job: Notify admins
          |
    [Step 3: Redis Pub/Sub]
          |
          |---> Broadcast: "user_registered" event
          |---> Broadcast: Cache invalidation signal
          |
    [Complete!]
```

**Watch your console logs to see:**
- ✅ Workers picking up email, analytics, and notification jobs
- ✅ Event subscribers receiving broadcast messages
- ✅ Complete step-by-step flow

**Real-world scenario:**
This is exactly how modern applications handle user registration:
1. **NATS**: Synchronously create billing account (must wait for response)
2. **RabbitMQ**: Asynchronously send emails, track analytics (can happen later)
3. **Redis**: Notify all servers about the new user (instant broadcast)

---

## 📊 Watch the Console Logs

The real magic happens in your terminal! You'll see logs like:

```
[ExamplesService] === Combined Example: User Registration ===
[ExamplesService] Registering user: alice@example.com

[ExamplesService] Step 1: Creating billing account (NATS RPC)...
[Service] Sending NATS request...
[Service] Subject: billing.create

[ExamplesService] Step 2: Queuing background jobs (RabbitMQ)...
[ExamplesService] ✓ Queued: Send welcome email
[Email Worker] Processing: Send email to alice@example.com
[Email Worker] ✓ Email sent to alice@example.com

[ExamplesService] Step 3: Broadcasting events (Redis Pub/Sub)...
[User Events Listener] {"event":"user_registered","email":"alice@example.com"}
[Cache Manager] Invalidating: {"action":"clear","pattern":"users:*"}

[ExamplesService] ✅ User registration completed successfully!
```

---

## 🔍 Understanding the Patterns

### When to use each pattern:

| Pattern | Use Case | Example |
|---------|----------|---------|
| **NATS RPC** | Need immediate response | "Is this user authenticated?" |
| **RabbitMQ** | Background jobs that must not be lost | "Send this email later" |
| **Redis Pub/Sub** | Broadcast to multiple listeners | "New message for everyone!" |

### Key Differences:

```
NATS RPC:           [Request] ---> [Wait] ---> [Response]
RabbitMQ:           [Send Job] ---> [Queue] ---> [Worker processes later]
Redis Pub/Sub:      [Publish] ---> [Broadcast to all subscribers instantly]
```

---

## 🎯 Advanced: Create Your Own Example

### Add a new job type to RabbitMQ:

```typescript
// In examples.service.ts
await this.rabbitmqService.sendToQueue('my-custom-queue', JSON.stringify({
  task: 'do-something',
  data: { ... }
}));

// Setup consumer
await this.rabbitmqService.consume('my-custom-queue', (message) => {
  console.log('Processing custom job:', message);
  // Your logic here
});
```

### Add a new Redis channel:

```typescript
// Subscribe
await this.redisService.subscribe('my-channel', (message) => {
  console.log('Received:', message);
});

// Publish
await this.redisService.publish('my-channel', 'Hello World');
```

---

## 📚 API Reference

### Available Endpoints

```bash
GET  /examples              # View all available endpoints
POST /examples/setup        # Setup workers & subscribers
POST /examples/rabbitmq     # Test RabbitMQ job queue
POST /examples/redis        # Test Redis Pub/Sub
POST /examples/nats         # Test NATS RPC
POST /examples/combined     # Combined example (user registration)
```

---

## 🐛 Troubleshooting

### "RabbitMQ not connected"
```bash
docker-compose restart rabbitmq
```

### "Redis connection failed"
```bash
docker-compose restart redis
```

### "NATS timeout"
This is expected! NATS requires a responder service. The example shows what happens when no responder is available.

### Not seeing worker logs?
Make sure you ran `/examples/setup` first to activate workers!

---

## 💡 Pro Tips

1. **Run setup first**: Always call `/examples/setup` before testing
2. **Watch the logs**: The console shows all the action
3. **Try multiple times**: Send multiple jobs and see how workers handle them
4. **Check RabbitMQ UI**: Visit http://localhost:15672 to see queues
5. **Monitor Redis**: Use `redis-cli` to see pub/sub activity

---

## 🎓 Learning Path

1. ✅ Start with **RabbitMQ** example (most visual)
2. ✅ Try **Redis Pub/Sub** example (understand broadcasting)
3. ✅ Test **Combined** example (see everything together)
4. ✅ Read the source code in [examples.service.ts](./examples.service.ts)
5. ✅ Build your own example!

---

Happy learning! 🚀
