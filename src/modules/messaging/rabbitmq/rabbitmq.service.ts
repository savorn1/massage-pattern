import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';

export interface QueueStats {
  name: string;
  messageCount: number;
  consumerCount: number;
}

export interface ConsumedMessage {
  queue: string;
  content: string;
  timestamp: string;
  acked: boolean;
}

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection!: amqp.Connection;
  private channel!: amqp.Channel;
  private consumedMessages: ConsumedMessage[] = [];
  private activeConsumers = new Map<string, string>(); // queue → consumerTag

  async onModuleInit() {
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      );
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(1);
      this.logger.log('Connected to RabbitMQ');
    } catch (err) {
      this.logger.error('Failed to connect to RabbitMQ:', err);
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  // --- Direct Queue ---

  async sendToQueue(queue: string, message: string): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ not connected');
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(queue, Buffer.from(message), { persistent: true });
    this.logger.log(`Sent to queue "${queue}": ${message.substring(0, 100)}`);
  }

  async consume(queue: string, callback: (msg: string) => void): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ not connected');
    await this.channel.assertQueue(queue, { durable: true });

    // Don't add duplicate consumer for same queue
    if (this.activeConsumers.has(queue)) {
      this.logger.warn(`Already consuming from queue "${queue}"`);
      return;
    }

    const { consumerTag } = await this.channel.consume(queue, (msg) => {
      if (msg) {
        const content = msg.content.toString();
        callback(content);
        this.channel.ack(msg);

        this.consumedMessages.push({
          queue,
          content,
          timestamp: new Date().toISOString(),
          acked: true,
        });

        // Keep last 100
        if (this.consumedMessages.length > 100) {
          this.consumedMessages = this.consumedMessages.slice(-100);
        }
      }
    });

    this.activeConsumers.set(queue, consumerTag);
    this.logger.log(`Started consuming from queue "${queue}" (tag: ${consumerTag})`);
  }

  async cancelConsumer(queue: string): Promise<void> {
    const tag = this.activeConsumers.get(queue);
    if (tag && this.channel) {
      await this.channel.cancel(tag);
      this.activeConsumers.delete(queue);
      this.logger.log(`Cancelled consumer for queue "${queue}"`);
    }
  }

  // --- Exchange-based Publishing ---

  async publishToExchange(
    exchange: string,
    routingKey: string,
    message: string,
    type: 'direct' | 'fanout' | 'topic' | 'headers' = 'topic',
    headers?: Record<string, string>,
  ): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ not connected');
    await this.channel.assertExchange(exchange, type, { durable: true });
    const options: amqp.Options.Publish = { persistent: true };
    if (headers) {
      options.headers = headers;
    }
    this.channel.publish(exchange, routingKey, Buffer.from(message), options);
    this.logger.log(`Published to exchange "${exchange}" [${routingKey}] type=${type}`);
  }

  async bindQueueToExchange(
    queue: string,
    exchange: string,
    routingKey: string,
    exchangeType: 'direct' | 'fanout' | 'topic' | 'headers' = 'topic',
    bindHeaders?: Record<string, string>,
  ): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ not connected');
    await this.channel.assertExchange(exchange, exchangeType, { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    if (exchangeType === 'headers' && bindHeaders) {
      await this.channel.bindQueue(queue, exchange, '', bindHeaders);
    } else {
      await this.channel.bindQueue(queue, exchange, routingKey);
    }
    this.logger.log(`Bound queue "${queue}" to exchange "${exchange}" [${routingKey}] type=${exchangeType}`);
  }

  // --- Queue Management ---

  async getQueueStats(queue: string): Promise<QueueStats> {
    if (!this.channel) throw new Error('RabbitMQ not connected');
    const result = await this.channel.assertQueue(queue, { durable: true });
    return {
      name: queue,
      messageCount: result.messageCount,
      consumerCount: result.consumerCount,
    };
  }

  async purgeQueue(queue: string): Promise<number> {
    if (!this.channel) throw new Error('RabbitMQ not connected');
    const result = await this.channel.purgeQueue(queue);
    this.logger.log(`Purged queue "${queue}": ${result.messageCount} messages removed`);
    return result.messageCount;
  }

  async deleteQueue(queue: string): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ not connected');
    await this.cancelConsumer(queue);
    await this.channel.deleteQueue(queue);
    this.logger.log(`Deleted queue "${queue}"`);
  }

  // --- Status ---

  isConnected(): boolean {
    return !!this.connection && this.channel != null;
  }

  getConsumedMessages(): ConsumedMessage[] {
    return this.consumedMessages;
  }

  clearConsumedMessages(): void {
    this.consumedMessages = [];
  }

  getActiveConsumers(): string[] {
    return Array.from(this.activeConsumers.keys());
  }
}
