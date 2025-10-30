import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ExamplesService } from './examples.service';

@Controller('examples')
export class ExamplesController {
  constructor(private readonly examplesService: ExamplesService) {}

  @Get()
  getInfo() {
    return {
      title: 'Messaging Patterns - Live Examples',
      description:
        'Try these endpoints to see NATS, RabbitMQ, and Redis in action',
      endpoints: {
        nats: 'POST /examples/nats - NATS Request/Response demo',
        rabbitmq: 'POST /examples/rabbitmq - RabbitMQ job queue demo',
        redis: 'POST /examples/redis - Redis Pub/Sub demo',
        combined:
          'POST /examples/combined - All three working together (user registration)',
        setupWorkers:
          'POST /examples/setup - Setup workers and subscribers for demos',
      },
      quickStart: [
        '1. POST /examples/setup (setup workers first)',
        '2. POST /examples/rabbitmq (send jobs)',
        '3. POST /examples/redis (broadcast events)',
        '4. POST /examples/combined?email=test@example.com (full demo)',
      ],
    };
  }

  @Post('nats')
  async testNats() {
    return await this.examplesService.natsExample();
  }

  @Post('rabbitmq')
  async testRabbitMQ() {
    return await this.examplesService.rabbitmqExample();
  }

  @Post('redis')
  async testRedis() {
    return await this.examplesService.redisExample();
  }

  @Post('combined')
  async testCombined(@Query('email') email: string = 'test@example.com') {
    return await this.examplesService.combinedExample(email);
  }

  @Post('setup')
  async setupWorkers(): Promise<{
    success: boolean;
    message: string;
    details: {
      rabbitmq: { consumers: string[]; status: string };
      redis: { subscribers: string[]; status: string };
    };
    nextSteps: string[];
  }> {
    const rabbitmq = await this.examplesService.setupRabbitmqConsumers();
    const redis = await this.examplesService.setupRedisSubscribers();

    return {
      success: true,
      message: 'Workers and subscribers are now running!',
      details: {
        rabbitmq,
        redis,
      },
      nextSteps: [
        'Now you can try the other endpoints to see messages being processed',
        'Check your console logs to see workers in action',
      ],
    };
  }
}
