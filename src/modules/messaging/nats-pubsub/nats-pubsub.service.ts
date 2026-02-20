import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connect, NatsConnection, StringCodec, Subscription } from 'nats';

@Injectable()
export class NatsPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsPubSubService.name);
  private nc: NatsConnection;
  private sc = StringCodec();
  private subscriptions = new Map<string, Subscription>();
  private callbacks = new Map<string, Set<(message: string) => void>>();

  async onModuleInit() {
    try {
      this.nc = await connect({
        servers: process.env.NATS_URL || 'nats://localhost:4222',
      });
      this.logger.log('Connected to NATS (Pub/Sub)');
    } catch (err) {
      this.logger.error('Failed to connect to NATS:', err);
    }
  }

  async onModuleDestroy() {
    for (const sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();
    this.callbacks.clear();
    await this.nc?.close();
  }

  publish(subject: string, message: string): void {
    if (!this.nc) throw new Error('NATS not connected');
    this.nc.publish(subject, this.sc.encode(message));
    this.logger.log(`Published to ${subject}`);
  }

  subscribe(subject: string, callback: (message: string) => void): void {
    if (!this.nc) throw new Error('NATS not connected');

    if (!this.callbacks.has(subject)) {
      this.callbacks.set(subject, new Set());

      const sub = this.nc.subscribe(subject, {
        callback: (_err, msg) => {
          const decoded = this.sc.decode(msg.data);
          const cbs = this.callbacks.get(subject);
          if (cbs) {
            cbs.forEach((cb) => cb(decoded));
          }
        },
      });

      this.subscriptions.set(subject, sub);
      this.logger.log(`Subscribed to ${subject}`);
    }

    this.callbacks.get(subject)?.add(callback);
  }

  unsubscribe(subject: string): void {
    const sub = this.subscriptions.get(subject);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(subject);
      this.callbacks.delete(subject);
      this.logger.log(`Unsubscribed from ${subject}`);
    }
  }

  isConnected(): boolean {
    return this.nc && !this.nc.isClosed();
  }

  getSubscribedSubjects(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}
