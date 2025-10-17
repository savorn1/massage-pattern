import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getInfo() {
    return {
      message: 'NestJS Messaging Patterns Learning Project',
      patterns: [
        {
          name: 'WebSocket',
          description: 'Real-time bidirectional communication',
          testClient: '/websocket-client.html',
        },
        {
          name: 'Redis Pub/Sub',
          description: 'Publisher/Subscriber pattern with Redis',
          endpoint: '/redis-pubsub',
        },
        {
          name: 'NATS RPC',
          description: 'Request/Response with NATS',
          endpoint: '/nats-rpc',
        },
        {
          name: 'RabbitMQ',
          description: 'Background job processing',
          endpoint: '/rabbitmq',
        },
        {
          name: 'Final Project',
          description: 'Combines all 4 patterns',
          endpoint: '/final-project',
        },
      ],
    };
  }
}
