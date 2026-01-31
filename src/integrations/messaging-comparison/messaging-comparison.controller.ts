import { Controller, Get, Post, Body } from '@nestjs/common';
import { MessagingComparisonService } from './messaging-comparison.service';

@Controller('messaging-comparison')
export class MessagingComparisonController {
  constructor(private readonly comparisonService: MessagingComparisonService) {}

  /**
   * Compare publishing across all patterns
   * POST /messaging-comparison/publish
   */
  @Post('publish')
  async comparePublishing(@Body('message') message: string) {
    const results = await this.comparisonService.comparePublishing(
      message || 'Test message',
    );
    return {
      description: 'Publishing the same message using all three patterns',
      results,
    };
  }

  /**
   * Compare consuming behavior across all patterns
   * GET /messaging-comparison/consume
   */
  @Get('consume')
  async compareConsuming() {
    const results = await this.comparisonService.compareConsuming();
    return {
      description: 'Comparing how each pattern handles message consumption',
      results,
    };
  }

  /**
   * Get ASCII diagrams showing broadcast behavior
   * GET /messaging-comparison/diagrams
   */
  @Get('diagrams')
  getBroadcastDiagrams() {
    return this.comparisonService.compareBroadcastBehavior();
  }

  /**
   * Run full comparison with feature matrix
   * GET /messaging-comparison/full
   */
  @Get('full')
  async getFullComparison() {
    return this.comparisonService.runFullComparison();
  }

  /**
   * Demo: Order processing using all three patterns
   * POST /messaging-comparison/demo/order
   */
  @Post('demo/order')
  async orderProcessingDemo(@Body('orderId') orderId: string) {
    const result = await this.comparisonService.orderProcessingDemo(
      orderId || `ORD-${Date.now()}`,
    );
    return {
      title: 'Order Processing Demo',
      description:
        'Demonstrates how each pattern is used in a real-world order flow',
      ...result,
    };
  }

  /**
   * Quick reference guide
   * GET /messaging-comparison/guide
   */
  @Get('guide')
  getQuickGuide() {
    return {
      title: 'When to Use Each Pattern',
      decisionTree: `
Need a response immediately?
├─ YES → NATS RPC (not covered here)
└─ NO
   └─ Do all services need to receive the message?
      ├─ YES → Redis Pub/Sub (broadcast)
      └─ NO
         └─ Need message history/replay?
            ├─ YES → Redis Streams
            └─ NO
               └─ Job must not be lost?
                  ├─ YES → RabbitMQ
                  └─ NO → Redis Pub/Sub
      `,
      patterns: {
        'Redis Pub/Sub': {
          emoji: '📡',
          analogy: 'Radio broadcast - everyone tuned in hears it',
          bestFor: [
            'Real-time notifications',
            'Cache invalidation',
            'Live updates',
          ],
          avoid: [
            'Critical messages',
            'Jobs that must complete',
            'Anything requiring history',
          ],
          code: `
// Publisher
await pubsub.publish('events', 'Hello everyone!');

// Subscriber (receives in real-time)
await pubsub.subscribe('events', (msg) => console.log(msg));
          `,
        },
        'Redis Streams': {
          emoji: '📜',
          analogy: 'Append-only log - like a ledger that keeps all history',
          bestFor: [
            'Audit logs',
            'Event sourcing',
            'Activity feeds',
            'Replay capability',
          ],
          avoid: ['Simple fire-and-forget', 'When you need complex routing'],
          code: `
// Producer
const id = await streams.addMessage('events', { action: 'login', user: 'alice' });

// Consumer (can read history!)
const history = await streams.readMessages('events', '0', 100);

// Consumer Group (for parallel processing)
await streams.createConsumerGroup('events', 'workers');
const msg = await streams.readFromGroup('events', 'workers');
await streams.acknowledge('events', 'workers', msg.id);
          `,
        },
        RabbitMQ: {
          emoji: '📦',
          analogy:
            'Post office - packages are delivered reliably, one recipient each',
          bestFor: [
            'Background jobs',
            'Email sending',
            'File processing',
            'Critical tasks',
          ],
          avoid: [
            'Real-time broadcasts',
            'When you need message history',
            'Simple notifications',
          ],
          code: `
// Producer
await rabbitmq.sendToQueue('jobs', JSON.stringify({ task: 'send_email' }));

// Consumer (auto-acknowledged after processing)
await rabbitmq.consume('jobs', (msg) => {
  const job = JSON.parse(msg);
  processJob(job);
});
          `,
        },
      },
      comparison: {
        persistence: {
          'Pub/Sub': '❌ No',
          Streams: '✅ Yes',
          RabbitMQ: '✅ Yes',
        },
        history: {
          'Pub/Sub': '❌ No',
          Streams: '✅ Full replay',
          RabbitMQ: '❌ Consumed = deleted',
        },
        delivery: {
          'Pub/Sub': '1 message → All subscribers',
          Streams: '1 message → 1 consumer (in group)',
          RabbitMQ: '1 message → 1 worker',
        },
        acknowledgment: {
          'Pub/Sub': '❌ No',
          Streams: '✅ Yes',
          RabbitMQ: '✅ Yes',
        },
        speed: {
          'Pub/Sub': '⚡⚡⚡ Fastest',
          Streams: '⚡⚡ Fast',
          RabbitMQ: '⚡ Good',
        },
      },
    };
  }
}
