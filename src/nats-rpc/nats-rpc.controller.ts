import { Controller, Get, Post, Body } from '@nestjs/common';
import { NatsRpcService } from './nats-rpc.service';

@Controller('nats-rpc')
export class NatsRpcController {
  constructor(private readonly natsRpcService: NatsRpcService) {}

  @Get()
  getInfo() {
    return {
      pattern: 'NATS RPC',
      description: 'Request/Response communication with queue groups',
      status: this.natsRpcService.isConnected() ? 'connected' : 'disconnected',
      endpoints: {
        request: 'POST /nats-rpc/request',
        publish: 'POST /nats-rpc/publish',
        status: 'GET /nats-rpc/status',
      },
    };
  }

  @Post('request')
  async request(@Body() body: { subject: string; data: string }) {
    const response = await this.natsRpcService.request(body.subject, body.data);
    return { success: true, response };
  }

  @Post('publish')
  async publish(@Body() body: { subject: string; data: string }) {
    await this.natsRpcService.publish(body.subject, body.data);
    return { success: true };
  }

  @Get('status')
  getStatus() {
    return { connected: this.natsRpcService.isConnected() };
  }
}
