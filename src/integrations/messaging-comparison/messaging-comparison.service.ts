import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisPubsubService } from '../../messaging/redis-pubsub/redis-pubsub.service';
import { RedisStreamsService } from '../../messaging/redis-streams/redis-streams.service';
import { RabbitmqService } from '../../messaging/rabbitmq/rabbitmq.service';

export interface ComparisonResult {
  pattern: string;
  operation: string;
  success: boolean;
  data?: unknown;
  timing?: number;
  notes?: string;
}

@Injectable()
export class MessagingComparisonService implements OnModuleInit {
  private readonly logger = new Logger(MessagingComparisonService.name);

  constructor(
    private readonly pubsub: RedisPubsubService,
    private readonly streams: RedisStreamsService,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  onModuleInit() {
    this.logger.log('Messaging Comparison Service initialized');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COMPARISON: Publishing/Producing Messages
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Compare how each pattern handles publishing/producing a message
   */
  async comparePublishing(message: string): Promise<ComparisonResult[]> {
    const results: ComparisonResult[] = [];
    const timestamp = Date.now();

    // 1. Redis Pub/Sub - Fire and forget broadcast
    const pubsubStart = Date.now();
    try {
      const subscriberCount = await this.pubsub.publish(
        'comparison-channel',
        JSON.stringify({ message, timestamp }),
      );
      results.push({
        pattern: 'Redis Pub/Sub',
        operation: 'publish',
        success: true,
        timing: Date.now() - pubsubStart,
        data: { subscriberCount },
        notes:
          'Fire-and-forget. Returns subscriber count. Message lost if no subscribers!',
      });
    } catch (err) {
      results.push({
        pattern: 'Redis Pub/Sub',
        operation: 'publish',
        success: false,
        data: { error: (err as Error).message },
      });
    }

    // 2. Redis Streams - Persistent append-only log
    const streamsStart = Date.now();
    try {
      const messageId = await this.streams.addMessage('comparison-stream', {
        message,
        timestamp: timestamp.toString(),
        source: 'comparison-test',
      });
      results.push({
        pattern: 'Redis Streams',
        operation: 'addMessage',
        success: true,
        timing: Date.now() - streamsStart,
        data: { messageId },
        notes:
          'Persisted to stream. Can be read later. Returns unique message ID.',
      });
    } catch (err) {
      results.push({
        pattern: 'Redis Streams',
        operation: 'addMessage',
        success: false,
        data: { error: (err as Error).message },
      });
    }

    // 3. RabbitMQ - Durable queue
    const rabbitmqStart = Date.now();
    try {
      await this.rabbitmq.sendToQueue(
        'comparison-queue',
        JSON.stringify({ message, timestamp }),
      );
      results.push({
        pattern: 'RabbitMQ',
        operation: 'sendToQueue',
        success: true,
        timing: Date.now() - rabbitmqStart,
        notes: 'Persisted to durable queue. Message waits until consumed.',
      });
    } catch (err) {
      results.push({
        pattern: 'RabbitMQ',
        operation: 'sendToQueue',
        success: false,
        data: { error: (err as Error).message },
      });
    }

    return results;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COMPARISON: Subscribing/Consuming Messages
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Compare how each pattern handles consuming messages
   */
  async compareConsuming(): Promise<ComparisonResult[]> {
    const results: ComparisonResult[] = [];

    // 1. Redis Pub/Sub - Real-time subscription (callback-based)
    results.push({
      pattern: 'Redis Pub/Sub',
      operation: 'subscribe',
      success: true,
      notes: `
        // Callback-based, real-time only
        await pubsub.subscribe('channel', (message) => {
          console.log('Received:', message);
        });

        ⚠️ Only receives messages AFTER subscribing
        ⚠️ No message history
        ⚠️ No acknowledgment
      `,
    });

    // 2. Redis Streams - Can read history + consumer groups
    try {
      const messages = await this.streams.readLatestMessages(
        'comparison-stream',
        5,
      );
      results.push({
        pattern: 'Redis Streams',
        operation: 'readMessages',
        success: true,
        data: { messageCount: messages.length, messages },
        notes: `
          // Can read historical messages
          const history = await streams.readMessages('stream', '0', 100);

          // Or use consumer groups for workload distribution
          await streams.createConsumerGroup('stream', 'workers');
          const msg = await streams.readFromGroup('stream', 'workers');
          await streams.acknowledge('stream', 'workers', msg.id);

          ✓ Message persistence
          ✓ Read history anytime
          ✓ Consumer groups for scaling
          ✓ Acknowledgment & retry
        `,
      });
    } catch (err) {
      results.push({
        pattern: 'Redis Streams',
        operation: 'readMessages',
        success: false,
        data: { error: (err as Error).message },
      });
    }

    // 3. RabbitMQ - Queue-based consumption
    results.push({
      pattern: 'RabbitMQ',
      operation: 'consume',
      success: true,
      notes: `
        // Messages removed after ACK
        await rabbitmq.consume('queue', (msg) => {
          console.log('Processing:', msg);
          // Auto-acknowledged after callback
        });

        ✓ Guaranteed delivery
        ✓ Multiple workers (load balancing)
        ✓ Dead letter queues
        ✗ No message history (consumed = deleted)
      `,
    });

    return results;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COMPARISON: Broadcast vs Queue vs Stream
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Demonstrate the key difference in message delivery
   */
  compareBroadcastBehavior(): {
    pubsub: string;
    streams: string;
    rabbitmq: string;
    diagram: string;
  } {
    return {
      pubsub: `
┌─────────────────────────────────────────────────────────────────┐
│                    REDIS PUB/SUB (Broadcast)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Publisher ──────┬───────────────────────────────────────────  │
│      │            │                                             │
│   publish()       ▼                                             │
│      │       ┌─────────┐                                        │
│      │       │ Channel │                                        │
│      │       └────┬────┘                                        │
│      │            │                                             │
│      │     ┌──────┼──────┐                                      │
│      │     ▼      ▼      ▼                                      │
│      │   Sub1   Sub2   Sub3                                     │
│      │                                                          │
│   • ALL subscribers receive the SAME message                    │
│   • No persistence - message lost if no subscribers             │
│   • Super fast (<1ms)                                           │
└─────────────────────────────────────────────────────────────────┘
      `,

      streams: `
┌─────────────────────────────────────────────────────────────────┐
│                    REDIS STREAMS (Log)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Producer ─────────────────────────────────────────────────    │
│      │                                                          │
│   xadd()                                                        │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Stream: [msg1] [msg2] [msg3] [msg4] [msg5] ...          │   │
│   └────────────────────────┬────────────────────────────────┘   │
│                            │                                    │
│              ┌─────────────┴─────────────┐                      │
│              ▼                           ▼                      │
│        Simple Read              Consumer Group                  │
│     (all get all msgs)      (each msg to ONE consumer)          │
│                                          │                      │
│                               ┌──────────┼──────────┐           │
│                               ▼          ▼          ▼           │
│                            Worker1    Worker2    Worker3        │
│                            (msg1)     (msg2)     (msg3)         │
│                                                                 │
│   • Messages PERSISTED - can replay history                     │
│   • Consumer groups for parallel processing                     │
│   • Acknowledgment & retry for reliability                      │
└─────────────────────────────────────────────────────────────────┘
      `,

      rabbitmq: `
┌─────────────────────────────────────────────────────────────────┐
│                    RABBITMQ (Queue)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Producer ─────────────────────────────────────────────────    │
│      │                                                          │
│   sendToQueue()                                                 │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Queue: [msg1] [msg2] [msg3] ─────────────────────────── │   │
│   └────────────────────────┬────────────────────────────────┘   │
│                            │                                    │
│              ┌─────────────┼─────────────┐                      │
│              ▼             ▼             ▼                      │
│           Worker1       Worker2       Worker3                   │
│           (msg1)        (msg2)        (msg3)                    │
│                                                                 │
│   • Each message delivered to ONE worker only                   │
│   • Message DELETED after acknowledgment                        │
│   • No history - once consumed, it's gone                       │
│   • Supports exchanges for complex routing                      │
└─────────────────────────────────────────────────────────────────┘
      `,

      diagram: `
┌────────────────────────────────────────────────────────────────────────┐
│                      MESSAGE DELIVERY COMPARISON                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Same message sent to 3 consumers:                                     │
│                                                                        │
│  ╔═══════════════╦═══════════════╦═══════════════╦═══════════════╗    │
│  ║    Pattern    ║   Consumer 1  ║   Consumer 2  ║   Consumer 3  ║    │
│  ╠═══════════════╬═══════════════╬═══════════════╬═══════════════╣    │
│  ║ Pub/Sub       ║   ✓ msg       ║   ✓ msg       ║   ✓ msg       ║    │
│  ║ (broadcast)   ║   (copy)      ║   (copy)      ║   (copy)      ║    │
│  ╠═══════════════╬═══════════════╬═══════════════╬═══════════════╣    │
│  ║ Streams       ║   ✓ msg       ║   ✗           ║   ✗           ║    │
│  ║ (group mode)  ║   (assigned)  ║   (waiting)   ║   (waiting)   ║    │
│  ╠═══════════════╬═══════════════╬═══════════════╬═══════════════╣    │
│  ║ RabbitMQ      ║   ✓ msg       ║   ✗           ║   ✗           ║    │
│  ║ (queue)       ║   (assigned)  ║   (waiting)   ║   (waiting)   ║    │
│  ╚═══════════════╩═══════════════╩═══════════════╩═══════════════╝    │
│                                                                        │
│  Legend:                                                               │
│  ✓ = Receives message                                                  │
│  ✗ = Does not receive (waits for next message)                         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
      `,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FULL COMPARISON DEMO
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Run a full comparison demonstration
   */
  async runFullComparison(): Promise<{
    publishing: ComparisonResult[];
    consuming: ComparisonResult[];
    featureMatrix: Record<string, Record<string, string | boolean>>;
    useCases: Record<string, string[]>;
  }> {
    const publishing = await this.comparePublishing(
      'Test message ' + Date.now(),
    );
    const consuming = await this.compareConsuming();

    const featureMatrix = {
      'Redis Pub/Sub': {
        persistence: false,
        messageHistory: false,
        acknowledgment: false,
        consumerGroups: false,
        ordering: 'Not guaranteed',
        delivery: 'At-most-once',
        pattern: 'Broadcast (1-to-many)',
        latency: '< 1ms',
        complexity: 'Simple',
      },
      'Redis Streams': {
        persistence: true,
        messageHistory: true,
        acknowledgment: true,
        consumerGroups: true,
        ordering: 'Guaranteed',
        delivery: 'At-least-once',
        pattern: 'Log (flexible)',
        latency: '1-5ms',
        complexity: 'Medium',
      },
      RabbitMQ: {
        persistence: true,
        messageHistory: false,
        acknowledgment: true,
        consumerGroups: true,
        ordering: 'Guaranteed (per queue)',
        delivery: 'At-least-once',
        pattern: 'Queue (1-to-1)',
        latency: '5-20ms',
        complexity: 'Higher',
      },
    };

    const useCases = {
      'Redis Pub/Sub': [
        'Real-time notifications',
        'Cache invalidation',
        'Live dashboards',
        'Chat presence updates',
        'System-wide events',
      ],
      'Redis Streams': [
        'Event sourcing',
        'Activity feeds',
        'IoT data ingestion',
        'Audit logs',
        'Task processing with history',
      ],
      RabbitMQ: [
        'Email sending',
        'Image processing',
        'Report generation',
        'Payment processing',
        'Any job that must not be lost',
      ],
    };

    return {
      publishing,
      consuming,
      featureMatrix,
      useCases,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRACTICAL EXAMPLE: Order Processing
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Demonstrate all three patterns in a real-world order scenario
   */
  async orderProcessingDemo(orderId: string): Promise<{
    steps: Array<{
      step: number;
      pattern: string;
      action: string;
      reason: string;
    }>;
  }> {
    const timestamp = Date.now();

    // Step 1: Use Pub/Sub to broadcast "order created" event (real-time)
    await this.pubsub.publish(
      'order-events',
      JSON.stringify({
        event: 'order_created',
        orderId,
        timestamp,
      }),
    );

    // Step 2: Use Streams to log the order for audit/history
    await this.streams.addMessage('order-audit-log', {
      event: 'order_created',
      orderId,
      timestamp: timestamp.toString(),
      action: 'Order placed by customer',
    });

    // Step 3: Use RabbitMQ to queue background jobs
    await this.rabbitmq.sendToQueue(
      'email-jobs',
      JSON.stringify({
        type: 'order_confirmation',
        orderId,
        timestamp,
      }),
    );

    await this.rabbitmq.sendToQueue(
      'inventory-jobs',
      JSON.stringify({
        type: 'reserve_items',
        orderId,
        timestamp,
      }),
    );

    return {
      steps: [
        {
          step: 1,
          pattern: 'Redis Pub/Sub',
          action: 'Broadcast order_created event',
          reason:
            'All connected services (dashboard, analytics, notifications) receive instantly',
        },
        {
          step: 2,
          pattern: 'Redis Streams',
          action: 'Log to order-audit-log',
          reason:
            'Persistent audit trail. Can replay events. Useful for debugging and compliance.',
        },
        {
          step: 3,
          pattern: 'RabbitMQ',
          action: 'Queue email-jobs',
          reason:
            'Email must be sent eventually. Job is persisted and retried if worker fails.',
        },
        {
          step: 4,
          pattern: 'RabbitMQ',
          action: 'Queue inventory-jobs',
          reason:
            'Inventory reservation is critical. Must not be lost. Can be processed async.',
        },
      ],
    };
  }
}
