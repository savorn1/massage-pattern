import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connect, NatsConnection, StringCodec } from 'nats';

@Injectable()
export class NatsRpcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsRpcService.name);
  private nc: NatsConnection;
  private sc = StringCodec();

  async onModuleInit() {
    try {
      this.nc = await connect({
        servers: process.env.NATS_URL || 'nats://localhost:4222',
      });
      this.logger.log('Connected to NATS');
    } catch (err) {
      this.logger.error('Failed to connect to NATS:', err);
    }
  }

  async onModuleDestroy() {
    await this.nc?.close();
  }

  async request(subject: string, data: string): Promise<string> {
    if (!this.nc) throw new Error('NATS not connected');
    const msg = await this.nc.request(subject, this.sc.encode(data), {
      timeout: 5000,
    });
    return this.sc.decode(msg.data);
  }

  publish(subject: string, data: string) {
    if (!this.nc) throw new Error('NATS not connected');
    this.nc.publish(subject, this.sc.encode(data));
  }

  isConnected(): boolean {
    return this.nc && !this.nc.isClosed();
  }
}
