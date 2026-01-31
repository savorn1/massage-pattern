import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

export interface StreamMessage {
  id: string;
  data: Record<string, string>;
}

export interface ConsumerGroupInfo {
  name: string;
  consumers: number;
  pending: number;
  lastDeliveredId: string;
}

@Injectable()
export class RedisStreamsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisStreamsService.name);
  private redis: Redis;
  private consumerName: string;
  private isConsuming = false;

  onModuleInit() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.consumerName = `consumer-${process.pid}-${Date.now()}`;

    this.redis.on('connect', () => {
      this.logger.log('Redis Streams connected');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis Streams error:', err);
    });
  }

  async onModuleDestroy() {
    this.isConsuming = false;
    await this.redis.quit();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRODUCER METHODS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Add a message to a stream
   * @param stream - Stream name
   * @param data - Key-value data to store
   * @param maxLen - Optional max length (for capping)
   * @returns Message ID (timestamp-sequence format)
   */
  async addMessage(
    stream: string,
    data: Record<string, string | number>,
    maxLen?: number,
  ): Promise<string> {
    const fields = Object.entries(data).flat().map(String);

    let messageId: string;
    if (maxLen) {
      // XADD with MAXLEN for automatic trimming
      messageId = (await this.redis.xadd(
        stream,
        'MAXLEN',
        '~',
        maxLen,
        '*',
        ...fields,
      )) as string;
    } else {
      messageId = (await this.redis.xadd(stream, '*', ...fields)) as string;
    }

    this.logger.log(`Added message ${messageId} to stream ${stream}`);
    return messageId;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIMPLE CONSUMER METHODS (without consumer groups)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Read messages from stream (non-blocking)
   * @param stream - Stream name
   * @param startId - Start ID ('0' for all, '$' for new only)
   * @param count - Max messages to return
   */
  async readMessages(
    stream: string,
    startId = '0',
    count = 10,
  ): Promise<StreamMessage[]> {
    const results = await this.redis.xrange(stream, startId, '+', 'COUNT', count);
    return this.parseStreamResults(results);
  }

  /**
   * Read latest messages from stream
   * @param stream - Stream name
   * @param count - Number of messages
   */
  async readLatestMessages(
    stream: string,
    count = 10,
  ): Promise<StreamMessage[]> {
    const results = await this.redis.xrevrange(stream, '+', '-', 'COUNT', count);
    return this.parseStreamResults(results).reverse();
  }

  /**
   * Blocking read - wait for new messages
   * @param stream - Stream name
   * @param lastId - Last ID received ('$' for new only)
   * @param blockMs - Block timeout in milliseconds (0 = forever)
   * @param count - Max messages to return
   */
  async blockingRead(
    stream: string,
    lastId = '$',
    blockMs = 5000,
    count = 1,
  ): Promise<StreamMessage[]> {
    const results = await this.redis.xread(
      'COUNT',
      count,
      'BLOCK',
      blockMs,
      'STREAMS',
      stream,
      lastId,
    );

    if (!results) return [];

    const messages: StreamMessage[] = [];
    for (const [, streamMessages] of results as [string, [string, string[]][]][]) {
      for (const [id, fields] of streamMessages) {
        messages.push({ id, data: this.parseFields(fields) });
      }
    }
    return messages;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONSUMER GROUP METHODS (for scaling)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Create a consumer group
   * @param stream - Stream name
   * @param group - Consumer group name
   * @param startId - Start position ('0' for all, '$' for new only)
   */
  async createConsumerGroup(
    stream: string,
    group: string,
    startId = '$',
  ): Promise<boolean> {
    try {
      await this.redis.xgroup('CREATE', stream, group, startId, 'MKSTREAM');
      this.logger.log(`Created consumer group: ${group} for stream: ${stream}`);
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message?.includes('BUSYGROUP')) {
        this.logger.log(`Consumer group ${group} already exists`);
        return false;
      }
      throw err;
    }
  }

  /**
   * Read messages from consumer group
   * @param stream - Stream name
   * @param group - Consumer group name
   * @param count - Max messages to return
   * @param blockMs - Block timeout (0 = forever)
   */
  async readFromGroup(
    stream: string,
    group: string,
    count = 10,
    blockMs = 5000,
  ): Promise<StreamMessage[]> {
    const results = await this.redis.xreadgroup(
      'GROUP',
      group,
      this.consumerName,
      'COUNT',
      count,
      'BLOCK',
      blockMs,
      'STREAMS',
      stream,
      '>', // Only new messages
    );

    if (!results) return [];

    const messages: StreamMessage[] = [];
    for (const [, streamMessages] of results as [string, [string, string[]][]][]) {
      for (const [id, fields] of streamMessages) {
        messages.push({ id, data: this.parseFields(fields) });
      }
    }
    return messages;
  }

  /**
   * Acknowledge message was processed
   * @param stream - Stream name
   * @param group - Consumer group name
   * @param messageId - Message ID to acknowledge
   */
  async acknowledge(
    stream: string,
    group: string,
    messageId: string,
  ): Promise<number> {
    const result = await this.redis.xack(stream, group, messageId);
    this.logger.log(`Acknowledged message ${messageId} in group ${group}`);
    return result;
  }

  /**
   * Get pending messages (not yet acknowledged)
   * @param stream - Stream name
   * @param group - Consumer group name
   * @param count - Max messages to return
   */
  async getPendingMessages(
    stream: string,
    group: string,
    count = 10,
  ): Promise<Array<{ id: string; consumer: string; idleTime: number; deliveryCount: number }>> {
    const pending = await this.redis.xpending(stream, group, '-', '+', count);

    return (pending as [string, string, number, number][]).map(
      ([id, consumer, idleTime, deliveryCount]) => ({
        id,
        consumer,
        idleTime,
        deliveryCount,
      }),
    );
  }

  /**
   * Claim stuck messages from dead consumers
   * @param stream - Stream name
   * @param group - Consumer group name
   * @param minIdleTime - Minimum idle time in ms
   * @param count - Max messages to claim
   */
  async claimStuckMessages(
    stream: string,
    group: string,
    minIdleTime = 60000,
    count = 10,
  ): Promise<StreamMessage[]> {
    const pending = await this.getPendingMessages(stream, group, count);
    const messages: StreamMessage[] = [];

    for (const msg of pending) {
      if (msg.idleTime > minIdleTime) {
        const claimed = await this.redis.xclaim(
          stream,
          group,
          this.consumerName,
          minIdleTime,
          msg.id,
        );

        for (const [id, fields] of claimed as [string, string[]][]) {
          messages.push({ id, data: this.parseFields(fields) });
          this.logger.log(`Claimed stuck message ${id} from ${msg.consumer}`);
        }
      }
    }

    return messages;
  }

  /**
   * Start consuming messages with a handler (runs in background)
   * @param stream - Stream name
   * @param group - Consumer group name
   * @param handler - Async function to process messages
   * @param options - Consumer options
   */
  async startConsumer(
    stream: string,
    group: string,
    handler: (message: StreamMessage) => Promise<void>,
    options: { batchSize?: number; blockMs?: number; claimInterval?: number } = {},
  ): Promise<void> {
    const { batchSize = 10, blockMs = 5000, claimInterval = 30000 } = options;

    await this.createConsumerGroup(stream, group);
    this.isConsuming = true;

    // Periodically claim stuck messages
    const claimTimer = setInterval(async () => {
      if (this.isConsuming) {
        await this.claimStuckMessages(stream, group);
      }
    }, claimInterval);

    this.logger.log(`Started consumer for stream: ${stream}, group: ${group}`);

    // Main consume loop
    while (this.isConsuming) {
      try {
        const messages = await this.readFromGroup(stream, group, batchSize, blockMs);

        for (const message of messages) {
          try {
            await handler(message);
            await this.acknowledge(stream, group, message.id);
          } catch (err) {
            this.logger.error(`Error processing message ${message.id}:`, err);
            // Message stays in pending - will be retried or claimed
          }
        }
      } catch (err) {
        this.logger.error('Consumer error:', err);
        await this.sleep(1000);
      }
    }

    clearInterval(claimTimer);
    this.logger.log(`Stopped consumer for stream: ${stream}, group: ${group}`);
  }

  /**
   * Stop the consumer loop
   */
  stopConsumer(): void {
    this.isConsuming = false;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get stream length
   */
  async getStreamLength(stream: string): Promise<number> {
    return this.redis.xlen(stream);
  }

  /**
   * Get stream info
   */
  async getStreamInfo(stream: string): Promise<Record<string, unknown> | null> {
    try {
      const info = await this.redis.xinfo('STREAM', stream);
      return this.parseInfoArray(info as unknown[]);
    } catch {
      return null;
    }
  }

  /**
   * Get consumer group info
   */
  async getGroupInfo(stream: string): Promise<ConsumerGroupInfo[]> {
    try {
      const groups = await this.redis.xinfo('GROUPS', stream);
      return (groups as unknown[][]).map((g) => {
        const obj = this.parseInfoArray(g);
        return {
          name: obj.name as string,
          consumers: obj.consumers as number,
          pending: obj.pending as number,
          lastDeliveredId: obj['last-delivered-id'] as string,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Trim stream to max length
   */
  async trimStream(stream: string, maxLen: number): Promise<number> {
    return this.redis.xtrim(stream, 'MAXLEN', '~', maxLen);
  }

  /**
   * Delete messages from stream
   */
  async deleteMessages(stream: string, ...messageIds: string[]): Promise<number> {
    return this.redis.xdel(stream, ...messageIds);
  }

  /**
   * Delete entire stream
   */
  async deleteStream(stream: string): Promise<number> {
    return this.redis.del(stream);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.redis.status === 'ready';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  private parseFields(fields: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      result[fields[i]] = fields[i + 1];
    }
    return result;
  }

  private parseStreamResults(results: [string, string[]][]): StreamMessage[] {
    return results.map(([id, fields]) => ({
      id,
      data: this.parseFields(fields),
    }));
  }

  private parseInfoArray(arr: unknown[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (let i = 0; i < arr.length; i += 2) {
      result[arr[i] as string] = arr[i + 1];
    }
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
