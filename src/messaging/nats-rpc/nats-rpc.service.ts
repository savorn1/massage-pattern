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
    console.log('[Service] Sending NATS request...');
    console.log('[Service] Subject:', subject);
    console.log('[Service] Data:', data);

    if (!this.nc) throw new Error('NATS not connected');

    try {
      const msg = await this.nc.request(subject, this.sc.encode(data), {
        timeout: 5000,
      });
      const response = this.sc.decode(msg.data);

      console.log('[Service] Response received:', response);

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[Service] Request failed:', errorMessage);
      throw error;
    }
  }

  publish(subject: string, data: string) {
    console.log('[Service] Publishing NATS message...');
    console.log('[Service] Subject:', subject);
    console.log('[Service] Data:', data);

    if (!this.nc) throw new Error('NATS not connected');

    this.nc.publish(subject, this.sc.encode(data));

    console.log('[Service] Message published to NATS');
  }

  isConnected(): boolean {
    return this.nc && !this.nc.isClosed();
  }
}
