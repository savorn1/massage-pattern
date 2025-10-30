# 🎯 Live Examples Guide

## Quick Test Commands

Once your application is running (`npm run start:dev`), try these commands:

### Step 1: Setup Workers (Required First!)

```bash
curl -X POST http://localhost:3000/examples/setup
```

### Step 2: Test RabbitMQ Job Queue

```bash
curl -X POST http://localhost:3000/examples/rabbitmq
```

**Watch your console!** You'll see:
```
[Email Worker] Processing: Send email to user@example.com
[Email Worker] ✓ Email sent to user@example.com
[Image Worker] Processing image img-123: resize, compress, watermark
[Image Worker] ✓ Image img-123 processed
[Report Worker] Generating monthly-sales report (pdf)
[Report Worker] ✓ Report rpt-456 generated
```

### Step 3: Test Redis Pub/Sub

```bash
curl -X POST http://localhost:3000/examples/redis
```

**Watch your console!** You'll see:
```
[User Events Listener] User Alice logged in
[Alert System] 🚨 High CPU usage detected
[Cache Manager] Invalidating: {"key":"user:123","action":"delete"}
```

### Step 4: Combined Example (All Three!)

```bash
curl -X POST "http://localhost:3000/examples/combined?email=alice@example.com"
```

**Watch your console!** You'll see all three messaging systems working together:
```
=== Combined Example: User Registration ===
Step 1: Creating billing account (NATS RPC)...
Step 2: Queuing background jobs (RabbitMQ)...
✓ Queued: Send welcome email
✓ Queued: Track signup event
✓ Queued: Notify admins
Step 3: Broadcasting events (Redis Pub/Sub)...
✓ Broadcast to 2 subscriber(s)
✅ User registration completed successfully!

[Email Worker] Processing: Send email to alice@example.com
[Analytics Worker] Tracking event: user_registered
[Notifications Worker] New user registered: alice@example.com
[User Events Listener] {"event":"user_registered","email":"alice@example.com"}
[Cache Manager] Invalidating: {"action":"clear","pattern":"users:*"}
```

---

## 📊 Visual Flow Diagrams

### RabbitMQ: Job Queue Pattern

```
You send 3 jobs:
┌─────────────────────────────────────────────────────┐
│  POST /examples/rabbitmq                            │
└──────────────┬──────────────────────────────────────┘
               │
               ├──> [emails queue]        ──> Email Worker (1 second)
               │                              └─> ✓ Email sent!
               │
               ├──> [image-processing]    ──> Image Worker (2 seconds)
               │                              └─> ✓ Image processed!
               │
               └──> [reports queue]       ──> Report Worker (3 seconds)
                                              └─> ✓ Report generated!

Jobs are PERSISTENT (survive crashes)
Workers process jobs ONE BY ONE
Multiple workers can share the load
```

### Redis: Pub/Sub Pattern

```
You publish 3 events:
┌─────────────────────────────────────────────────────┐
│  POST /examples/redis                               │
└──────────────┬──────────────────────────────────────┘
               │
               ├──> [user-activity]  ──────┬──> User Events Listener
               │                            └──> Activity Tracker
               │
               ├──> [system-alerts]  ──────┬──> Alert System 🚨
               │
               │
               └──> [cache-invalidation] ──┬──> Cache Manager
                                            └──> All Server Instances

Events are INSTANT (no persistence)
ALL subscribers receive the message
Fire-and-forget (no acknowledgment)
```

### NATS: Request/Response Pattern

```
You send a request:
┌─────────────────────────────────────────────────────┐
│  POST /examples/nats                                │
└──────────────┬──────────────────────────────────────┘
               │
               ├──> [Request: "greet.Alice"]
               │            │
               │            ├──> NATS Server routes to responder
               │            │
               │            └──> Responder: "Hello, Alice!"
               │                       │
               └────────────<──────────┘
                      (5 second timeout)

Request waits for RESPONSE
Timeout if no responder available
Perfect for microservices communication
```

---

## 🔥 Real-World Scenario: E-commerce Order

```typescript
async function processOrder(orderId: string, userId: string) {

  // 1. NATS RPC - Call payment service (MUST WAIT for result)
  const payment = await nats.request('payment.charge', {
    orderId,
    amount: 99.99
  });

  if (!payment.success) {
    return { error: 'Payment failed' };
  }

  // 2. RabbitMQ - Queue background jobs (process later)
  await rabbitmq.sendToQueue('inventory', { action: 'reserve', orderId });
  await rabbitmq.sendToQueue('shipping', { action: 'prepare', orderId });
  await rabbitmq.sendToQueue('emails', {
    to: user.email,
    template: 'order-confirmation',
    orderId
  });

  // 3. Redis Pub/Sub - Broadcast event to all services (instant)
  await redis.publish('orders', JSON.stringify({
    event: 'order_placed',
    orderId,
    userId,
    timestamp: new Date()
  }));

  return { success: true, orderId };
}
```

**What happens:**

```
User clicks "Buy Now"
        │
        ▼
[1. NATS RPC] ───> Payment Service
                   "Charge $99.99"
                   ◀──── Success! ────┐
                                      │
[2. RabbitMQ Jobs]                    │
        │                             │
        ├─> Queue: Reserve inventory  │
        ├─> Queue: Prepare shipping   │ (Continues immediately
        └─> Queue: Send confirmation  │  without waiting)
                                      │
[3. Redis Broadcast]                  │
        │                             │
        ├─> Analytics service         │
        ├─> Recommendation engine     │
        └─> Admin dashboard           │
                                      │
        ▼                             │
Return to user: "Order placed!" ◀─────┘
```

---

## 🎓 Pattern Selection Guide

### Question: "Should I send a welcome email when user signs up?"

**Answer: RabbitMQ** ✅
- Email can be sent later (not urgent)
- Must not be lost (important communication)
- Worker can retry if SMTP server is down

### Question: "Should I check if user's password is correct?"

**Answer: NATS RPC** ✅
- Need immediate yes/no answer
- Cannot proceed without response
- Fast request/response needed

### Question: "Should I notify all servers that user logged out?"

**Answer: Redis Pub/Sub** ✅
- All servers need to know instantly
- Session cache needs invalidation
- Event-based notification

---

## 🎬 Try It Yourself!

### 1. Simple RabbitMQ Test

```bash
# Setup
curl -X POST http://localhost:3000/examples/setup

# Send jobs (try multiple times!)
curl -X POST http://localhost:3000/examples/rabbitmq
curl -X POST http://localhost:3000/examples/rabbitmq
curl -X POST http://localhost:3000/examples/rabbitmq

# Watch workers process jobs in your console!
```

### 2. Simple Redis Test

```bash
# Setup
curl -X POST http://localhost:3000/examples/setup

# Broadcast events
curl -X POST http://localhost:3000/examples/redis

# Watch subscribers receive events instantly!
```

### 3. Full Registration Flow

```bash
# Setup
curl -X POST http://localhost:3000/examples/setup

# Register different users
curl -X POST "http://localhost:3000/examples/combined?email=alice@example.com"
curl -X POST "http://localhost:3000/examples/combined?email=bob@example.com"
curl -X POST "http://localhost:3000/examples/combined?email=charlie@example.com"

# Watch the complete flow for each user!
```

---

## 📈 Performance Comparison

### Speed Test (approximate):

| Pattern | Latency | Throughput |
|---------|---------|------------|
| **NATS RPC** | ~1-5ms | 100k+ msg/sec |
| **Redis Pub/Sub** | ~1ms | 1M+ msg/sec |
| **RabbitMQ** | ~5-20ms | 50k+ msg/sec |

**Note:** RabbitMQ is slower because it provides reliability and persistence!

---

## 🚀 Next Steps

1. ✅ Run all examples to see them in action
2. ✅ Read the source code: [examples.service.ts](src/examples/examples.service.ts)
3. ✅ Modify the examples to add your own logic
4. ✅ Check RabbitMQ Management UI: http://localhost:15672
5. ✅ Monitor NATS: http://localhost:8222
6. ✅ Build your own messaging patterns!

---

## 📚 Learn More

- **RabbitMQ Patterns**: https://www.rabbitmq.com/getstarted.html
- **Redis Pub/Sub**: https://redis.io/topics/pubsub
- **NATS Documentation**: https://docs.nats.io/
- **NestJS Microservices**: https://docs.nestjs.com/microservices/basics

---

**Happy coding!** 🎉
