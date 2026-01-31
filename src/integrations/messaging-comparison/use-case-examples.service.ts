import { Injectable, Logger } from '@nestjs/common';
import { RedisPubsubService } from '../../messaging/redis-pubsub/redis-pubsub.service';
import { RedisStreamsService } from '../../messaging/redis-streams/redis-streams.service';
import { RabbitmqService } from '../../messaging/rabbitmq/rabbitmq.service';
import { BullmqService } from '../../workers/bullmq/bullmq.service';

/**
 * Real-world examples showing WHEN to use each messaging pattern
 */
@Injectable()
export class UseCaseExamplesService {
  private readonly logger = new Logger(UseCaseExamplesService.name);

  constructor(
    private readonly pubsub: RedisPubsubService,
    private readonly streams: RedisStreamsService,
    private readonly rabbitmq: RabbitmqService,
    private readonly bullmq: BullmqService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // EXAMPLE 1: User Registration Flow
  // Shows when to use each pattern in a single user action
  // ════════════════════════════════════════════════════════════════════════════

  async userRegistration(userData: {
    userId: string;
    email: string;
    name: string;
  }) {
    const { userId, email, name } = userData;
    this.logger.log(`Processing registration for user: ${userId}`);

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 1: Redis Pub/Sub - Real-time notification                      │
    // │ WHY: Dashboard and analytics need to know IMMEDIATELY               │
    // │ CHARACTERISTICS: Fast, fire-and-forget, all subscribers receive     │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.pubsub.publish(
      'user-events',
      JSON.stringify({
        event: 'user_registered',
        userId,
        timestamp: Date.now(),
      }),
    );
    this.logger.log('✓ [Pub/Sub] Broadcasted user_registered event');

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 2: Redis Streams - Audit log                                   │
    // │ WHY: Need permanent record for compliance and debugging             │
    // │ CHARACTERISTICS: Persistent, can replay, ordered                    │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.streams.addMessage('user-audit-log', {
      event: 'registration',
      userId,
      email,
      name,
      timestamp: Date.now().toString(),
      ip: '192.168.1.1', // Example
    });
    this.logger.log('✓ [Streams] Logged to audit trail');

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 3: BullMQ Worker - Send welcome email                          │
    // │ WHY: Email sending is slow (1-5s), can fail, needs retry            │
    // │ CHARACTERISTICS: Background, retry on failure, don't block user     │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.bullmq.addJobWithRetry(
      'emails',
      'send-welcome-email',
      {
        to: email,
        subject: `Welcome ${name}!`,
        body: `Thanks for joining us, ${name}. Your account is ready.`,
        template: 'welcome',
      },
      3, // 3 retry attempts
    );
    this.logger.log('✓ [BullMQ] Queued welcome email');

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 4: BullMQ Worker - Generate avatar (delayed)                   │
    // │ WHY: CPU intensive, user doesn't need immediately                   │
    // │ CHARACTERISTICS: Delayed execution, background processing           │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.bullmq.addDelayedJob(
      'images',
      'generate-avatar',
      {
        imageId: `avatar-${userId}`,
        source: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
        operations: [
          { type: 'resize', params: { width: 200, height: 200 } },
          { type: 'compress', params: { quality: 85 } },
        ],
        outputFormat: 'webp',
      },
      5000, // Delay 5 seconds
    );
    this.logger.log('✓ [BullMQ] Scheduled avatar generation');

    return {
      success: true,
      userId,
      message: 'Registration complete',
      asyncTasks: ['welcome email', 'avatar generation'],
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXAMPLE 2: E-commerce Order Processing
  // Complete order flow using multiple patterns
  // ════════════════════════════════════════════════════════════════════════════

  async processOrder(orderData: {
    orderId: string;
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    total: number;
  }) {
    const { orderId, customerId, items, total } = orderData;
    this.logger.log(`Processing order: ${orderId}`);

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 1: Redis Streams - Order event log (Event Sourcing)            │
    // │ WHY: Complete history of order state changes for audit/replay       │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.streams.addMessage('order-events', {
      event: 'order_created',
      orderId,
      customerId,
      itemCount: items.length.toString(),
      total: total.toString(),
      timestamp: Date.now().toString(),
    });

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 2: Redis Pub/Sub - Notify real-time dashboard                  │
    // │ WHY: Admin dashboard shows live order updates                       │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.pubsub.publish(
      'orders-live',
      JSON.stringify({
        type: 'new_order',
        orderId,
        total,
        timestamp: Date.now(),
      }),
    );

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 3: RabbitMQ - Payment processing (critical job)                │
    // │ WHY: Must not be lost, needs acknowledgment, sequential processing  │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.rabbitmq.sendToQueue(
      'payment-queue',
      JSON.stringify({
        orderId,
        customerId,
        amount: total,
        currency: 'USD',
      }),
    );

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 4: BullMQ - Inventory reservation (background with retry)      │
    // │ WHY: May need retries if stock system is temporarily down           │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.bullmq.addJobWithRetry(
      'inventory',
      'reserve-items',
      { orderId, items },
      5, // 5 retry attempts
    );

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 5: BullMQ - Order confirmation email                           │
    // │ WHY: Not urgent, can be slightly delayed, needs retry               │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.bullmq.addJob('emails', 'order-confirmation', {
      to: `customer-${customerId}@example.com`,
      subject: `Order ${orderId} Confirmed`,
      body: `Your order of $${total} has been received.`,
      orderId,
    });

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 6: BullMQ - Generate invoice PDF (delayed, CPU intensive)      │
    // │ WHY: Takes time, user doesn't need immediately                      │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.bullmq.addDelayedJob(
      'documents',
      'generate-invoice',
      { orderId, customerId, items, total },
      10000, // Delay 10 seconds
    );

    return {
      success: true,
      orderId,
      status: 'processing',
      message: 'Order received and being processed',
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXAMPLE 3: Real-time Chat Application
  // ════════════════════════════════════════════════════════════════════════════

  async sendChatMessage(messageData: {
    roomId: string;
    senderId: string;
    content: string;
    type: 'text' | 'image' | 'file';
  }) {
    const { roomId, senderId, content, type } = messageData;
    const messageId = `msg-${Date.now()}`;

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 1: Redis Streams - Store message permanently                   │
    // │ WHY: Chat history must be persistent and retrievable                │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.streams.addMessage(
      `chat:${roomId}`,
      {
        messageId,
        senderId,
        content,
        type,
        timestamp: Date.now().toString(),
      },
      10000, // Keep last 10000 messages per room
    );

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 2: Redis Pub/Sub - Broadcast to room members                   │
    // │ WHY: All connected users in room need to see message instantly      │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.pubsub.publish(
      `room:${roomId}`,
      JSON.stringify({
        messageId,
        senderId,
        content,
        type,
        timestamp: Date.now(),
      }),
    );

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 3: BullMQ - Send push notifications (for offline users)        │
    // │ WHY: Offline users need push notification, can be slightly delayed  │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.bullmq.addJob('notifications', 'push-notification', {
      roomId,
      senderId,
      preview: content.substring(0, 50),
      excludeUsers: [senderId], // Don't notify sender
    });

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 4 (if image): BullMQ - Process image thumbnail                 │
    // │ WHY: Generate thumbnail for preview, CPU intensive                  │
    // └─────────────────────────────────────────────────────────────────────┘
    if (type === 'image') {
      await this.bullmq.addJob('images', 'generate-thumbnail', {
        imageId: messageId,
        source: content, // URL to image
        operations: [
          { type: 'resize', params: { width: 300, height: 300 } },
          { type: 'compress', params: { quality: 70 } },
        ],
      });
    }

    return { messageId, status: 'sent' };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXAMPLE 4: Analytics Event Tracking
  // ════════════════════════════════════════════════════════════════════════════

  async trackEvent(eventData: {
    userId: string;
    event: string;
    properties: Record<string, unknown>;
    sessionId: string;
  }) {
    const { userId, event, properties, sessionId } = eventData;

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ Redis Streams - Event log for analytics                             │
    // │ WHY: Need to store all events, query later, replay for analysis     │
    // │ BEST CHOICE because: High volume, needs history, ordered            │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.streams.addMessage(
      'analytics-events',
      {
        userId,
        event,
        properties: JSON.stringify(properties),
        sessionId,
        timestamp: Date.now().toString(),
        userAgent: 'Mozilla/5.0...', // Example
      },
      1000000, // Keep last 1M events
    );

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ Redis Pub/Sub - Real-time analytics dashboard                       │
    // │ WHY: Dashboard shows live event feed                                │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.pubsub.publish(
      'analytics-live',
      JSON.stringify({ userId, event, timestamp: Date.now() }),
    );

    return { tracked: true };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXAMPLE 5: File Upload Processing
  // ════════════════════════════════════════════════════════════════════════════

  async processFileUpload(fileData: {
    fileId: string;
    userId: string;
    filename: string;
    mimetype: string;
    size: number;
    path: string;
  }) {
    const { fileId, userId, filename, mimetype, size, path } = fileData;

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 1: Redis Streams - Log upload event                            │
    // │ WHY: Audit trail of all uploads                                     │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.streams.addMessage('file-uploads', {
      fileId,
      userId,
      filename,
      mimetype,
      size: size.toString(),
      timestamp: Date.now().toString(),
    });

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 2: BullMQ - Virus scan (CRITICAL, must complete)               │
    // │ WHY: Security critical, needs retry, must complete before serving   │
    // └─────────────────────────────────────────────────────────────────────┘
    const scanJob = await this.bullmq.addPriorityJob(
      'security',
      'virus-scan',
      { fileId, path },
      1, // High priority
    );

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 3: BullMQ - Generate preview/thumbnail                         │
    // │ WHY: CPU intensive, user can wait, not blocking                     │
    // └─────────────────────────────────────────────────────────────────────┘
    if (mimetype.startsWith('image/')) {
      await this.bullmq.addJob('images', 'generate-preview', {
        imageId: fileId,
        source: path,
        operations: [
          { type: 'resize', params: { width: 400, height: 400 } },
          { type: 'convert', params: { format: 'webp' } },
        ],
      });
    }

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ STEP 4: Redis Pub/Sub - Notify user of upload complete              │
    // │ WHY: User's browser needs to know file is ready                     │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.pubsub.publish(
      `user:${userId}:files`,
      JSON.stringify({
        event: 'upload_complete',
        fileId,
        filename,
      }),
    );

    return {
      fileId,
      status: 'processing',
      scanJobId: scanJob.id,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXAMPLE 6: Scheduled Reports
  // ════════════════════════════════════════════════════════════════════════════

  async scheduleReport(reportData: {
    reportId: string;
    userId: string;
    type: 'daily' | 'weekly' | 'monthly';
    email: string;
  }) {
    const { reportId, userId, type, email } = reportData;

    // Map report type to cron pattern
    const cronPatterns: Record<string, string> = {
      daily: '0 9 * * *', // Every day at 9am
      weekly: '0 9 * * 1', // Every Monday at 9am
      monthly: '0 9 1 * *', // 1st of every month at 9am
    };

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ BullMQ - Scheduled/Repeating job                                    │
    // │ WHY: Cron-like scheduling, persistent, survives restarts            │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.bullmq.addRepeatingJob(
      'reports',
      'generate-report',
      { reportId, userId, type, email },
      cronPatterns[type],
    );

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ Redis Streams - Log subscription                                    │
    // │ WHY: Track who subscribed to what reports                           │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.streams.addMessage('report-subscriptions', {
      action: 'subscribe',
      reportId,
      userId,
      type,
      email,
      timestamp: Date.now().toString(),
    });

    return {
      reportId,
      schedule: type,
      cronPattern: cronPatterns[type],
      status: 'scheduled',
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXAMPLE 7: Cache Invalidation (Pub/Sub perfect use case)
  // ════════════════════════════════════════════════════════════════════════════

  async invalidateCache(key: string, reason: string) {
    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ Redis Pub/Sub - Broadcast cache invalidation                        │
    // │ WHY: All app servers need to know to clear their local cache        │
    // │ PERFECT for Pub/Sub: Fire-and-forget, all instances need it         │
    // └─────────────────────────────────────────────────────────────────────┘
    await this.pubsub.publish(
      'cache-invalidation',
      JSON.stringify({
        key,
        pattern: key.includes('*') ? key : undefined,
        reason,
        timestamp: Date.now(),
      }),
    );

    this.logger.log(`Cache invalidation broadcasted: ${key}`);
    return { invalidated: key, broadcastedAt: Date.now() };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY: Quick Decision Guide
  // ════════════════════════════════════════════════════════════════════════════

  getDecisionGuide() {
    return {
      'Redis Pub/Sub': {
        use_when: [
          'Real-time notifications to connected clients',
          'Cache invalidation across servers',
          'Live dashboard updates',
          'Presence updates (user online/offline)',
          'Fire-and-forget broadcasts',
        ],
        dont_use_when: [
          'Message must not be lost',
          'Need message history',
          'Offline clients need to receive later',
        ],
        example_code: `
await pubsub.publish('events', JSON.stringify({ type: 'user_online', userId: '123' }));
        `,
      },
      'Redis Streams': {
        use_when: [
          'Need message history/replay',
          'Audit logs and compliance',
          'Event sourcing',
          'Activity feeds',
          'Analytics event tracking',
          'Chat message history',
        ],
        dont_use_when: [
          'Simple fire-and-forget',
          'Need complex routing (use RabbitMQ)',
        ],
        example_code: `
await streams.addMessage('audit-log', { action: 'login', userId: '123' });
const history = await streams.readMessages('audit-log', '0', 100);
        `,
      },
      RabbitMQ: {
        use_when: [
          'Critical jobs that must complete',
          'Need complex routing (exchanges)',
          'Inter-service communication',
          'Message ordering is critical',
        ],
        dont_use_when: [
          'Need message history (consumed = deleted)',
          'Real-time broadcasts to many clients',
        ],
        example_code: `
await rabbitmq.sendToQueue('payments', JSON.stringify({ orderId, amount }));
        `,
      },
      'BullMQ Workers': {
        use_when: [
          'Background job processing',
          'Tasks with retry logic',
          'Delayed/scheduled jobs',
          'Rate-limited processing',
          'CPU-intensive tasks (images, PDFs)',
          'Email sending',
        ],
        dont_use_when: [
          'User needs immediate response',
          'Simple, fast operations (<50ms)',
        ],
        example_code: `
await bullmq.addJobWithRetry('emails', 'send', { to, subject }, 3);
await bullmq.addDelayedJob('reports', 'generate', data, 60000);
await bullmq.addRepeatingJob('cleanup', 'run', {}, '0 3 * * *');
        `,
      },
    };
  }
}
