# 🔄 How NATS, RabbitMQ, and Redis Work

A comprehensive guide to understanding the three messaging patterns in this project.

---

## 📖 Table of Contents

1. [NATS - Request/Response Pattern](#nats---requestresponse-pattern)
2. [RabbitMQ - Job Queue Pattern](#rabbitmq---job-queue-pattern)
3. [Redis - Pub/Sub Pattern](#redis---pubsub-pattern)
4. [Side-by-Side Comparison](#side-by-side-comparison)
5. [When to Use What](#when-to-use-what)
6. [Real-World Examples](#real-world-examples)

---

## 1. NATS - Request/Response Pattern

### 🎯 Purpose
Call a remote service and **wait for a response** (like calling a function on another server).

### 🔧 How It Works

```
Client A                 NATS Server               Service B
   |                          |                        |
   | 1. Request("auth",       |                        |
   |    "check-token")        |                        |
   |------------------------->|                        |
   |                          | 2. Route to            |
   |                          |    subscriber          |
   |                          |----------------------->|
   |                          |                        | 3. Process
   |                          |                        |    request
   |                          | 4. Response            |
   |                          |    "valid"             |
   |                          |<-----------------------|
   | 5. Return                |                        |
   |    "valid"               |                        |
   |<-------------------------|                        |
   |                          |                        |
```

### 💻 Code Implementation

**Sender (Client A):**
```typescript
// Send request and WAIT for response
const result = await natsService.request('auth.check', 'my-token');
console.log('Token is:', result); // "valid" or "invalid"

// If no response in 5 seconds → throws timeout error
```

**Receiver (Service B):**
```typescript
// In a separate microservice
natsConnection.subscribe('auth.check', (err, msg) => {
  const token = msg.data;
  const isValid = validateToken(token);

  // Send response back
  msg.respond(isValid ? 'valid' : 'invalid');
});
```

### ⚡ Characteristics

| Feature | Value |
|---------|-------|
| **Latency** | 1-5ms |
| **Pattern** | 1-to-1 (point-to-point) |
| **Waits for response** | ✅ Yes (with timeout) |
| **Persistence** | ❌ No |
| **Guaranteed delivery** | ❌ No (fails if no responder) |

### 📦 Use Cases

✅ **Perfect for:**
- Microservice-to-microservice calls
- Authentication checks
- API gateways calling backend services
- Any operation requiring immediate response

❌ **Don't use for:**
- Broadcasting to multiple services
- Background jobs that can fail
- Operations that don't need responses

---

## 2. RabbitMQ - Job Queue Pattern

### 🎯 Purpose
Queue **background jobs** that need reliable processing (jobs are persisted and won't be lost).

### 🔧 How It Works

```
Producer              RabbitMQ Queue                Worker 1    Worker 2
   |                        |                          |           |
   | 1. Send Job A          |                          |           |
   |----------------------->|                          |           |
   |                        | [Job A] [Job B] [Job C]  |           |
   | 2. Send Job B          |                          |           |
   |----------------------->|                          |           |
   |                        |                          |           |
   | 3. Send Job C          | 4. Deliver Job A         |           |
   |----------------------->|------------------------->|           |
   |                        |                          | Process   |
   |                        |                          | Job A     |
   |                        | 5. Deliver Job B         |           |
   |                        |------------------------------->      |
   |                        |                          |      | Process
   |                        |                          |      | Job B
   |                        | 6. ACK (done)            |           |
   |                        |<-------------------------|           |
   |                        |                          |      |
   |                        | 7. Deliver Job C         |      |
   |                        |------------------------->|      |
   |                        |                          |      |
```

### 💻 Code Implementation

**Producer:**
```typescript
// Send job to queue (fire and forget)
await rabbitmqService.sendToQueue('emails', JSON.stringify({
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up'
}));

// Job is now PERSISTED in queue
// Will survive even if RabbitMQ crashes!
```

**Worker (Consumer):**
```typescript
// Worker picks up jobs and processes them
await rabbitmqService.consume('emails', async (message) => {
  const emailData = JSON.parse(message);

  console.log(`Sending email to ${emailData.to}...`);
  await sendEmail(emailData);
  console.log(`Email sent!`);

  // Message is auto-acknowledged (ACK)
});
```

### ⚡ Characteristics

| Feature | Value |
|---------|-------|
| **Latency** | 5-20ms |
| **Pattern** | Queue (FIFO) |
| **Waits for response** | ❌ No (fire-and-forget) |
| **Persistence** | ✅ Yes (durable queues) |
| **Guaranteed delivery** | ✅ Yes (with acknowledgment) |
| **Load balancing** | ✅ Yes (multiple workers) |

### 📦 Use Cases

✅ **Perfect for:**
- Sending emails
- Processing uploaded images/videos
- Generating reports
- Long-running tasks
- Tasks that MUST NOT be lost

❌ **Don't use for:**
- Real-time chat messages
- Operations requiring immediate response
- Broadcasting to multiple services

### 🔄 Job Lifecycle

```
1. Producer sends job → Queue
2. Queue persists job to disk (durable)
3. Worker picks up job
4. Worker processes job
5. Worker sends ACK (acknowledgment)
6. Queue deletes job

If worker crashes before ACK:
→ Job returns to queue
→ Another worker picks it up
→ Job is NOT LOST!
```

---

## 3. Redis - Pub/Sub Pattern

### 🎯 Purpose
**Broadcast events** to all interested subscribers instantly (fire-and-forget).

### 🔧 How It Works

```
Publisher A    Publisher B     Redis        Subscriber 1  Subscriber 2  Subscriber 3
    |              |              |              |             |             |
    |              |              |<--Subscribe--|             |             |
    |              |              |    "news"    |             |             |
    |              |              |              |             |             |
    |              |              |<--Subscribe--|-------------|             |
    |              |              |    "news"    |             |             |
    |              |              |              |             |             |
    |              |              |<--Subscribe--|-------------|-------------|
    |              |              |    "alerts"  |             |             |
    |              |              |              |             |             |
    | Publish      |              |              |             |             |
    | "news"       |              |              |             |             |
    | "Bitcoin up!"|              |              |             |             |
    |------------->|              |              |             |             |
    |              |              |--Broadcast-->|             |             |
    |              |              |    "Bitcoin  |             |             |
    |              |              |     up!"     |             |             |
    |              |              |              |             |             |
    |              |              |--Broadcast-->|------------>|             |
    |              |              |              |             |             |
    |              | Publish      |              |             |             |
    |              | "alerts"     |              |             |             |
    |              | "Warning!"   |              |             |             |
    |              |------------->|              |             |             |
    |              |              |              |             |             |
    |              |              |--Broadcast-->|-------------|------------>|
    |              |              |    "Warning!"|             |             |
```

### 💻 Code Implementation

**Publisher:**
```typescript
// Publish event to channel (instant broadcast)
const subscriberCount = await redisService.publish(
  'user-events',
  JSON.stringify({ event: 'user_login', userId: 123 })
);

console.log(`Sent to ${subscriberCount} subscribers`);
// Returns 0 if no subscribers (message is lost!)
```

**Subscriber:**
```typescript
// Subscribe to channel
await redisService.subscribe('user-events', (message) => {
  console.log('Received event:', message);

  // Parse and process
  const event = JSON.parse(message);

  if (event.event === 'user_login') {
    console.log(`User ${event.userId} logged in!`);
  }
});

// Can subscribe to multiple channels
await redisService.subscribe('system-alerts', (message) => {
  console.log('ALERT:', message);
});
```

### ⚡ Characteristics

| Feature | Value |
|---------|-------|
| **Latency** | <1ms |
| **Pattern** | 1-to-many (broadcast) |
| **Waits for response** | ❌ No |
| **Persistence** | ❌ No (if no subscribers, message lost) |
| **Guaranteed delivery** | ❌ No |
| **Fan-out** | ✅ Yes (all subscribers receive) |

### 📦 Use Cases

✅ **Perfect for:**
- Broadcasting events across multiple servers
- Cache invalidation
- Real-time notifications
- Live updates (scores, prices)
- System-wide events

❌ **Don't use for:**
- Critical messages that must not be lost
- Jobs requiring processing
- Operations needing responses

### 🔄 Message Flow

```
1. Publisher publishes to channel
2. Redis broadcasts to ALL current subscribers
3. Subscribers receive message instantly
4. No persistence (if subscriber offline, message lost)

Important:
- If 0 subscribers → message disappears
- If 3 subscribers → all 3 receive the message
- Subscribers added AFTER publish → don't receive old messages
```

---

## Side-by-Side Comparison

### Architecture Patterns

```
NATS RPC (Request/Response):
┌─────────┐         ┌──────┐         ┌─────────┐
│ Client  │-------->│ NATS │-------->│ Service │
│    A    │<--------│      │<--------│    B    │
└─────────┘  wait   └──────┘  reply  └─────────┘

RabbitMQ (Queue):
┌─────────┐         ┌───────────┐         ┌────────┐
│Producer │-------->│   Queue   │-------->│ Worker │
│         │         │  [Job A]  │         │   1    │
└─────────┘         │  [Job B]  │    ┌--->│        │
                    │  [Job C]  │----│    └────────┘
                    └───────────┘    │    ┌────────┐
                                     └--->│ Worker │
                                          │   2    │
                                          └────────┘

Redis Pub/Sub (Broadcast):
                    ┌───────────┐
              ┌---->│Subscriber │
              │     │     1     │
┌───────────┐ │     └───────────┘
│ Publisher │-│     ┌───────────┐
│           │-│---->│Subscriber │
└───────────┘ │     │     2     │
              │     └───────────┘
              │     ┌───────────┐
              └---->│Subscriber │
                    │     3     │
                    └───────────┘
```

### Feature Matrix

| Feature | NATS | RabbitMQ | Redis Pub/Sub |
|---------|------|----------|---------------|
| **Speed** | ⚡⚡⚡ Very Fast | 🐇 Fast | ⚡⚡⚡ Very Fast |
| **Reliability** | Medium | 🛡️ High | Low |
| **Persistence** | ❌ No | ✅ Yes | ❌ No |
| **Response** | ✅ Yes | ❌ No | ❌ No |
| **Delivery** | 1-to-1 | 1-to-1 | 1-to-many |
| **Load Balancing** | ✅ Queue groups | ✅ Multiple workers | ❌ All receive |
| **Use Case** | Microservices RPC | Background jobs | Event broadcast |

---

## When to Use What

### Decision Tree

```
Need a response immediately?
├─ YES → Use NATS RPC
└─ NO
   └─ Multiple services need to know?
      ├─ YES → Use Redis Pub/Sub
      └─ NO
         └─ Job must not be lost?
            ├─ YES → Use RabbitMQ
            └─ NO → Use Redis Pub/Sub
```

### Practical Examples

#### Scenario 1: User Places Order

```typescript
async function placeOrder(order) {
  // 1. NATS: Charge credit card (MUST wait for result)
  const payment = await nats.request('payment.charge', order.amount);

  if (!payment.success) {
    throw new Error('Payment failed');
  }

  // 2. RabbitMQ: Queue background jobs
  await rabbitmq.sendToQueue('inventory', { reserve: order.items });
  await rabbitmq.sendToQueue('emails', { sendConfirmation: order.email });
  await rabbitmq.sendToQueue('shipping', { prepare: order.id });

  // 3. Redis: Broadcast event to all services
  await redis.publish('orders', JSON.stringify({
    event: 'order_placed',
    orderId: order.id
  }));

  return { success: true };
}
```

**Why?**
- **NATS**: Can't proceed without payment confirmation
- **RabbitMQ**: Emails/shipping can happen later, must not be lost
- **Redis**: All servers need to know about order instantly

---

## Real-World Examples

### Example 1: Social Media Platform

**User posts a message:**

```typescript
async function createPost(userId, message) {
  // 1. NATS: Check if user is allowed to post (spam filter)
  const canPost = await nats.request('spam.check', { userId, message });

  if (canPost !== 'ok') {
    return { error: 'Message flagged as spam' };
  }

  // Save to database
  const post = await db.posts.create({ userId, message });

  // 2. RabbitMQ: Queue image processing (if post has images)
  if (post.hasImages) {
    await rabbitmq.sendToQueue('images', {
      postId: post.id,
      images: post.images
    });
  }

  // 3. Redis: Broadcast to all connected users
  await redis.publish('feed-updates', JSON.stringify({
    event: 'new_post',
    postId: post.id,
    userId: userId
  }));

  return { success: true, postId: post.id };
}
```

### Example 2: Ride-Sharing App

**User requests ride:**

```typescript
async function requestRide(userId, location) {
  // 1. NATS: Find available drivers nearby
  const drivers = await nats.request('drivers.nearby', {
    lat: location.lat,
    lng: location.lng,
    radius: 5
  });

  if (drivers.length === 0) {
    return { error: 'No drivers available' };
  }

  // Create ride request
  const ride = await db.rides.create({ userId, location });

  // 2. Redis: Broadcast to all drivers
  await redis.publish('driver-notifications', JSON.stringify({
    event: 'ride_request',
    rideId: ride.id,
    location: location
  }));

  // 3. RabbitMQ: Queue analytics tracking
  await rabbitmq.sendToQueue('analytics', {
    event: 'ride_requested',
    userId,
    timestamp: new Date()
  });

  return { success: true, rideId: ride.id };
}
```

### Example 3: Banking Application

**Transfer money:**

```typescript
async function transferMoney(fromAccount, toAccount, amount) {
  // 1. NATS: Verify account balance (MUST wait)
  const hasBalance = await nats.request('accounts.checkBalance', {
    accountId: fromAccount,
    amount: amount
  });

  if (hasBalance !== 'sufficient') {
    return { error: 'Insufficient funds' };
  }

  // 2. NATS: Perform transfer (MUST wait for confirmation)
  const result = await nats.request('transfers.execute', {
    from: fromAccount,
    to: toAccount,
    amount: amount
  });

  if (result !== 'success') {
    return { error: 'Transfer failed' };
  }

  // 3. RabbitMQ: Queue notification emails (reliable delivery)
  await rabbitmq.sendToQueue('emails', {
    to: fromAccount.email,
    template: 'transfer_sent',
    amount: amount
  });

  await rabbitmq.sendToQueue('emails', {
    to: toAccount.email,
    template: 'transfer_received',
    amount: amount
  });

  // 4. Redis: Invalidate cached balances on all servers
  await redis.publish('cache-invalidate', JSON.stringify({
    keys: [`balance:${fromAccount}`, `balance:${toAccount}`]
  }));

  return { success: true };
}
```

---

## 🎓 Summary

### NATS RPC
- **Think:** Phone call (request → response)
- **Speed:** ⚡⚡⚡
- **Reliability:** Medium
- **Use when:** Need immediate answer

### RabbitMQ
- **Think:** Post office (reliable delivery)
- **Speed:** 🐇
- **Reliability:** ⭐⭐⭐
- **Use when:** Job must not be lost

### Redis Pub/Sub
- **Think:** Radio broadcast (everyone hears it)
- **Speed:** ⚡⚡⚡
- **Reliability:** Low
- **Use when:** Multiple services need instant notification

---

## 🚀 Try It Yourself!

Run the live examples in this project:

```bash
# Setup
npm run start:dev
curl -X POST http://localhost:3000/examples/setup

# Test each pattern
curl -X POST http://localhost:3000/examples/rabbitmq
curl -X POST http://localhost:3000/examples/redis
curl -X POST http://localhost:3000/examples/combined?email=test@example.com
```

See [EXAMPLES_GUIDE.md](./EXAMPLES_GUIDE.md) for detailed instructions!
