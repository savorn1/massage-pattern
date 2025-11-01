import { Controller, Get, Post, Body } from '@nestjs/common';
import { RabbitmqService } from './rabbitmq.service';

@Controller('rabbitmq')
export class RabbitmqController {
  constructor(private readonly rabbitmqService: RabbitmqService) {}

  @Get()
  getInfo() {
    return {
      pattern: 'RabbitMQ',
      description: 'Background job processing with worker pattern',
      status: this.rabbitmqService.isConnected() ? 'connected' : 'disconnected',
      endpoints: {
        send: 'POST /rabbitmq/send',
        status: 'GET /rabbitmq/status',
      },
    };
  }

  @Post('send')
  async send(@Body() body: { queue: string; message: string }) {
    await this.rabbitmqService.sendToQueue(body.queue, body.message);
    return { success: true, queue: body.queue };
  }

  @Get('status')
  getStatus() {
    return { connected: this.rabbitmqService.isConnected() };
  }
}
