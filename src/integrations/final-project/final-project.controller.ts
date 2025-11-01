import { Controller, Get } from '@nestjs/common';

@Controller('final-project')
export class FinalProjectController {
  @Get()
  getInfo() {
    return {
      pattern: 'Final Project',
      description: 'Combines all 4 messaging patterns',
      message:
        'Coming soon: A complete application using WebSocket, Redis Pub/Sub, NATS RPC, and RabbitMQ',
    };
  }
}
