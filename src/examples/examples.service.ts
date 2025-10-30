import { Injectable, Logger } from '@nestjs/common';
import { NatsRpcService } from '../nats-rpc/nats-rpc.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { RedisPubsubService } from '../redis-pubsub/redis-pubsub.service';

export interface Step {
  step: number;
  action: string;
  method: string;
  status: string;
  response?: string;
  reason?: string;
  queue?: string;
  subscribers?: number;
}

export interface CombinedExampleResult {
  steps: Step[];
  success: boolean;
  error?: string;
}

@Injectable()
export class ExamplesService {
  private readonly logger = new Logger(ExamplesService.name);

  constructor(
    private readonly natsService: NatsRpcService,
    private readonly rabbitmqService: RabbitmqService,
    private readonly redisService: RedisPubsubService,
  ) {}

  /**
   * Example 1: NATS Request/Response
   * Use case: Call a microservice and wait for response
   */
  async natsExample() {
    this.logger.log('=== NATS RPC Example ===');

    try {
      // Example 1: Simple greeting
      this.logger.log('Sending greeting request...');
      const greeting = await this.natsService.request('greet', 'Alice');
      this.logger.log(`Response: ${greeting}`);

      // Example 2: Get user data (simulated)
      this.logger.log('Requesting user data...');
      const userData = await this.natsService.request(
        'user.get',
        JSON.stringify({ userId: 123 }),
      );
      this.logger.log(`User data: ${userData}`);

      // Example 3: Calculate something
      this.logger.log('Requesting calculation...');
      const result = await this.natsService.request(
        'math.add',
        JSON.stringify({ a: 5, b: 3 }),
      );
      this.logger.log(`Calculation result: ${result}`);

      return {
        success: true,
        examples: [
          { type: 'greeting', response: greeting },
          { type: 'user-data', response: userData },
          { type: 'calculation', response: result },
        ],
      };
    } catch (error) {
      this.logger.error('NATS example failed:', error);
      return {
        success: false,
        error:
          'No responder available. Start a NATS responder to see this work!',
      };
    }
  }

  /**
   * Example 2: RabbitMQ Job Queue
   * Use case: Background job processing
   */
  async rabbitmqExample() {
    this.logger.log('=== RabbitMQ Job Queue Example ===');

    try {
      // Send multiple jobs to different queues
      const jobs = [
        {
          queue: 'emails',
          message: JSON.stringify({
            to: 'user@example.com',
            subject: 'Welcome!',
            body: 'Thanks for signing up',
          }),
        },
        {
          queue: 'image-processing',
          message: JSON.stringify({
            imageId: 'img-123',
            operations: ['resize', 'compress', 'watermark'],
          }),
        },
        {
          queue: 'reports',
          message: JSON.stringify({
            reportId: 'rpt-456',
            type: 'monthly-sales',
            format: 'pdf',
          }),
        },
      ];

      for (const job of jobs) {
        this.logger.log(`Sending job to ${job.queue}...`);
        await this.rabbitmqService.sendToQueue(job.queue, job.message);
        this.logger.log(`✓ Job sent to ${job.queue}`);
      }

      return {
        success: true,
        jobsSent: jobs.length,
        queues: jobs.map((j) => j.queue),
        message: 'Jobs queued successfully. Workers will process them.',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('RabbitMQ example failed:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Example 3: Redis Pub/Sub
   * Use case: Broadcast events to multiple subscribers
   */
  async redisExample() {
    this.logger.log('=== Redis Pub/Sub Example ===');

    try {
      // Publish to multiple channels
      const events = [
        { channel: 'user-activity', message: 'User Alice logged in' },
        { channel: 'system-alerts', message: 'High CPU usage detected' },
        {
          channel: 'cache-invalidation',
          message: JSON.stringify({ key: 'user:123', action: 'delete' }),
        },
      ];

      for (const event of events) {
        this.logger.log(`Publishing to ${event.channel}...`);
        const subscriberCount = await this.redisService.publish(
          event.channel,
          event.message,
        );
        this.logger.log(
          `✓ Published to ${subscriberCount} subscriber(s) on ${event.channel}`,
        );
      }

      return {
        success: true,
        eventsPublished: events.length,
        channels: events.map((e) => e.channel),
        message: 'Events broadcast to all subscribers',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Redis example failed:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Example 4: Combined Real-World Scenario
   * Use case: Complete user registration flow
   */
  async combinedExample(email: string): Promise<CombinedExampleResult> {
    this.logger.log('=== Combined Example: User Registration ===');
    this.logger.log(`Registering user: ${email}`);

    const results: CombinedExampleResult = {
      steps: [],
      success: true,
    };

    try {
      // Step 1: Call billing service via NATS RPC
      this.logger.log('Step 1: Creating billing account (NATS RPC)...');
      try {
        const billingResponse = await this.natsService.request(
          'billing.create',
          JSON.stringify({ email }),
        );
        results.steps.push({
          step: 1,
          action: 'Create billing account',
          method: 'NATS RPC',
          status: 'success',
          response: billingResponse,
        });
        this.logger.log(`✓ Billing account created`);
      } catch {
        results.steps.push({
          step: 1,
          action: 'Create billing account',
          method: 'NATS RPC',
          status: 'skipped',
          reason: 'No billing service available (demo mode)',
        });
      }

      // Step 2: Queue background jobs via RabbitMQ
      this.logger.log('Step 2: Queuing background jobs (RabbitMQ)...');

      const jobs = [
        {
          queue: 'emails',
          task: 'Send welcome email',
          data: {
            to: email,
            template: 'welcome',
            subject: 'Welcome to our platform!',
          },
        },
        {
          queue: 'analytics',
          task: 'Track signup event',
          data: { event: 'user_registered', email, timestamp: new Date() },
        },
        {
          queue: 'notifications',
          task: 'Notify admins',
          data: { message: `New user registered: ${email}` },
        },
      ];

      for (const job of jobs) {
        await this.rabbitmqService.sendToQueue(
          job.queue,
          JSON.stringify(job.data),
        );
        results.steps.push({
          step: 2,
          action: job.task,
          method: 'RabbitMQ',
          status: 'queued',
          queue: job.queue,
        });
        this.logger.log(`✓ Queued: ${job.task}`);
      }

      // Step 3: Broadcast events via Redis Pub/Sub
      this.logger.log('Step 3: Broadcasting events (Redis Pub/Sub)...');

      const events = [
        {
          channel: 'user-events',
          message: JSON.stringify({ event: 'user_registered', email }),
        },
        {
          channel: 'cache-invalidation',
          message: JSON.stringify({ action: 'clear', pattern: 'users:*' }),
        },
      ];

      for (const event of events) {
        const subscribers = await this.redisService.publish(
          event.channel,
          event.message,
        );
        results.steps.push({
          step: 3,
          action: `Broadcast to ${event.channel}`,
          method: 'Redis Pub/Sub',
          status: 'published',
          subscribers,
        });
        this.logger.log(`✓ Broadcast to ${subscribers} subscriber(s)`);
      }

      this.logger.log('✅ User registration completed successfully!');
      return results;
    } catch (error) {
      this.logger.error('Combined example failed:', error);
      results.success = false;
      results.error = error instanceof Error ? error.message : 'Unknown error';
      return results;
    }
  }

  /**
   * Setup NATS responders (for demo purposes)
   */
  setupNatsResponders() {
    this.logger.log('Setting up NATS responders...');

    // Note: In real applications, these would be separate microservices
    // For demo, we'll set up simple responders in the same app

    // This is just a placeholder - actual implementation would require
    // subscribing to subjects which NATS client doesn't expose directly
    // in this simple wrapper

    return {
      message:
        'In production, these would be separate microservices responding to NATS requests',
    };
  }

  /**
   * Setup RabbitMQ consumers (workers)
   */
  async setupRabbitmqConsumers() {
    this.logger.log('Setting up RabbitMQ consumers...');

    // Email worker
    await this.rabbitmqService.consume('emails', (message) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(message);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.log(`[Email Worker] Processing: Send email to ${data.to}`);
      // Simulate email sending
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.log(`[Email Worker] ✓ Email sent to ${data.to}`);
      }, 1000);
    });

    // Image processing worker
    await this.rabbitmqService.consume('image-processing', (message) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(message);
      this.logger.log(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        `[Image Worker] Processing image ${data.imageId}: ${data.operations.join(', ')}`,
      );
      // Simulate image processing
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.log(`[Image Worker] ✓ Image ${data.imageId} processed`);
      }, 2000);
    });

    // Report worker
    await this.rabbitmqService.consume('reports', (message) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(message);
      this.logger.log(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `[Report Worker] Generating ${data.type} report (${data.format})`,
      );
      // Simulate report generation
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.log(`[Report Worker] ✓ Report ${data.reportId} generated`);
      }, 3000);
    });

    // Analytics worker
    await this.rabbitmqService.consume('analytics', (message) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(message);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.log(`[Analytics Worker] Tracking event: ${data.event}`);
    });

    // Notifications worker
    await this.rabbitmqService.consume('notifications', (message) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(message);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.log(`[Notifications Worker] ${data.message}`);
    });

    this.logger.log('✓ All RabbitMQ consumers are running');

    return {
      consumers: [
        'emails',
        'image-processing',
        'reports',
        'analytics',
        'notifications',
      ],
      status: 'active',
    };
  }

  /**
   * Setup Redis subscribers
   */
  async setupRedisSubscribers() {
    this.logger.log('Setting up Redis subscribers...');

    // Subscribe to user events
    await this.redisService.subscribe('user-events', (message) => {
      this.logger.log(`[User Events Listener] ${message}`);
    });

    // Subscribe to system alerts
    await this.redisService.subscribe('system-alerts', (message) => {
      this.logger.log(`[Alert System] 🚨 ${message}`);
    });

    // Subscribe to cache invalidation
    await this.redisService.subscribe('cache-invalidation', (message) => {
      this.logger.log(`[Cache Manager] Invalidating: ${message}`);
    });

    // Subscribe to user activity
    await this.redisService.subscribe('user-activity', (message) => {
      this.logger.log(`[Activity Tracker] ${message}`);
    });

    this.logger.log('✓ All Redis subscribers are active');

    return {
      subscribers: [
        'user-events',
        'system-alerts',
        'cache-invalidation',
        'user-activity',
      ],
      status: 'active',
    };
  }
}
