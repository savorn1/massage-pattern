import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisPubsubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPubsubService.name);
  private publisher: Redis;
  private subscriber: Redis;
  private subscribers = new Map<string, Set<(message: string) => void>>();

  async onModuleInit() {
    // Create Redis connections
    this.publisher = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.publisher.on('connect', () => {
      this.logger.log('Redis Publisher connected');
    });

    this.subscriber.on('connect', () => {
      this.logger.log('Redis Subscriber connected');
    });

    this.publisher.on('error', (err) => {
      this.logger.error('Redis Publisher error:', err);
    });

    this.subscriber.on('error', (err) => {
      this.logger.error('Redis Subscriber error:', err);
    });

    // Handle incoming messages
    this.subscriber.on('message', (channel: string, message: string) => {
      this.logger.log(`Received message on channel ${channel}: ${message}`);
      const callbacks = this.subscribers.get(channel);
      if (callbacks) {
        callbacks.forEach((callback) => callback(message));
      }
    });
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  async publish(channel: string, message: string): Promise<number> {
    this.logger.log(`Publishing to ${channel}: ${message}`);
    return await this.publisher.publish(channel, message);
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    this.logger.log(`Subscribing to channel: ${channel}`);

    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }

    this.subscribers.get(channel)?.add(callback);
  }

  async unsubscribe(
    channel: string,
    callback?: (message: string) => void,
  ): Promise<void> {
    this.logger.log(`Unsubscribing from channel: ${channel}`);

    if (callback && this.subscribers.has(channel)) {
      this.subscribers.get(channel)?.delete(callback);

      if (this.subscribers.get(channel)?.size === 0) {
        this.subscribers.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    } else {
      this.subscribers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  getSubscribedChannels(): string[] {
    return Array.from(this.subscribers.keys());
  }

  getSubscriberCount(channel: string): number {
    return this.subscribers.get(channel)?.size || 0;
  }

  isConnected(): boolean {
    return (
      this.publisher.status === 'ready' && this.subscriber.status === 'ready'
    );
  }
}
