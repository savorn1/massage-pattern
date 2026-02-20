import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

export type MessageStatus =
  | 'processing'
  | 'completed'
  | 'retry_1'
  | 'retry_2'
  | 'retry_3'
  | 'dead';

export interface DlqMessage {
  id: string;
  payload: Record<string, unknown>;
  status: MessageStatus;
  queue: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastAttemptAt?: string;
  deadAt?: string;
  error?: string;
  retryHistory: {
    attempt: number;
    timestamp: string;
    delayMs: number;
    error: string;
  }[];
}

export interface DlqStats {
  mainQueue: { messages: number; consumers: number };
  retryQueues: { name: string; ttlMs: number; messages: number }[];
  dlq: { messages: number };
  processed: number;
  failed: number;
  retried: number;
  deadLettered: number;
}

export interface DlqConfig {
  failureMode: 'always' | 'random' | 'first_n' | 'never';
  failCount?: number; // for 'first_n' mode
  failProbability?: number; // for 'random' mode (0-1)
  maxRetries: number; // 1-5
  processingDelayMs: number;
}

@Injectable()
export class DlqService implements OnModuleInit {
  private readonly logger = new Logger(DlqService.name);
  private connection!: amqp.Connection;
  private channel!: amqp.Channel;

  // Queue names
  private readonly MAIN_QUEUE = 'dlq-demo.main';
  private readonly DLX_EXCHANGE = 'dlq-demo.dlx';
  private readonly DLQ_QUEUE = 'dlq-demo.dead-letter';
  private readonly RETRY_EXCHANGE = 'dlq-demo.retry';

  // Exponential backoff delays
  private readonly RETRY_DELAYS = [2000, 8000, 32000]; // 2s, 8s, 32s

  // In-memory tracking
  private messages: DlqMessage[] = [];
  private stats = {
    processed: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
  };
  private consuming = false;
  private currentConfig: DlqConfig = {
    failureMode: 'always',
    maxRetries: 3,
    processingDelayMs: 500,
  };
  private attemptCounts = new Map<string, number>(); // msgId -> total attempts

  async onModuleInit() {
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      );
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(1);
      await this.setupQueues();
      this.logger.log('DLQ demo queues initialized');
    } catch (err) {
      this.logger.error('Failed to initialize DLQ queues:', err);
    }
  }

  private async setupQueues(): Promise<void> {
    // Dead Letter Exchange — failed messages from main queue go here
    await this.channel.assertExchange(this.DLX_EXCHANGE, 'direct', {
      durable: true,
    });

    // Retry exchange — routes to retry queues with TTL
    await this.channel.assertExchange(this.RETRY_EXCHANGE, 'direct', {
      durable: true,
    });

    // Main queue — with DLX configured
    await this.channel.assertQueue(this.MAIN_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.DLX_EXCHANGE,
        'x-dead-letter-routing-key': 'dead',
      },
    });

    // Dead Letter Queue — final resting place for permanently failed messages
    await this.channel.assertQueue(this.DLQ_QUEUE, { durable: true });
    await this.channel.bindQueue(
      this.DLQ_QUEUE,
      this.DLX_EXCHANGE,
      'dead',
    );

    // Retry queues with exponential TTL — messages wait here then go back to main
    for (let i = 0; i < this.RETRY_DELAYS.length; i++) {
      const retryQueue = `dlq-demo.retry.${i + 1}`;
      await this.channel.assertQueue(retryQueue, {
        durable: true,
        arguments: {
          'x-message-ttl': this.RETRY_DELAYS[i],
          'x-dead-letter-exchange': '', // default exchange
          'x-dead-letter-routing-key': this.MAIN_QUEUE, // back to main
        },
      });
      await this.channel.bindQueue(
        retryQueue,
        this.RETRY_EXCHANGE,
        `retry.${i + 1}`,
      );
    }
  }

  async startConsuming(config: DlqConfig): Promise<void> {
    if (this.consuming) return;
    this.currentConfig = config;
    this.consuming = true;

    // Consume from main queue
    await this.channel.consume(
      this.MAIN_QUEUE,
      async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());
        const msgId: string = content.id;
        const retryCount =
          (msg.properties.headers?.['x-retry-count'] as number) || 0;

        // Track total attempts
        const totalAttempts = (this.attemptCounts.get(msgId) || 0) + 1;
        this.attemptCounts.set(msgId, totalAttempts);

        // Update message tracking
        this.updateMessage(msgId, {
          status: 'processing',
          retryCount,
          lastAttemptAt: new Date().toISOString(),
        });

        // Simulate processing delay
        await this.delay(this.currentConfig.processingDelayMs);

        // Determine if this should "fail"
        const shouldFail = this.shouldFail(msgId, totalAttempts);

        if (shouldFail) {
          const error = this.getFailureReason(totalAttempts);

          if (retryCount < this.currentConfig.maxRetries) {
            // Send to retry queue with exponential backoff
            const retryLevel = Math.min(
              retryCount + 1,
              this.RETRY_DELAYS.length,
            );
            const retryDelay = this.RETRY_DELAYS[retryLevel - 1];

            this.channel.publish(
              this.RETRY_EXCHANGE,
              `retry.${retryLevel}`,
              Buffer.from(msg.content),
              {
                persistent: true,
                headers: {
                  ...msg.properties.headers,
                  'x-retry-count': retryCount + 1,
                  'x-last-error': error,
                },
              },
            );
            this.channel.ack(msg);

            const statusKey =
              `retry_${retryCount + 1}` as MessageStatus;
            this.updateMessage(msgId, {
              status: statusKey,
              error,
              retryHistory: [
                ...(this.getMessage(msgId)?.retryHistory || []),
                {
                  attempt: retryCount + 1,
                  timestamp: new Date().toISOString(),
                  delayMs: retryDelay,
                  error,
                },
              ],
            });

            this.stats.retried++;
            this.logger.log(
              `Message ${msgId}: retry ${retryCount + 1}/${this.currentConfig.maxRetries} (wait ${retryDelay}ms)`,
            );
          } else {
            // Max retries exceeded — reject to DLX (dead letter)
            this.channel.nack(msg, false, false);

            this.updateMessage(msgId, {
              status: 'dead',
              error: `Max retries (${this.currentConfig.maxRetries}) exceeded. Last error: ${error}`,
              deadAt: new Date().toISOString(),
              retryHistory: [
                ...(this.getMessage(msgId)?.retryHistory || []),
                {
                  attempt: retryCount + 1,
                  timestamp: new Date().toISOString(),
                  delayMs: 0,
                  error: `DEAD LETTERED: ${error}`,
                },
              ],
            });

            this.stats.deadLettered++;
            this.logger.warn(`Message ${msgId}: DEAD LETTERED after ${retryCount + 1} attempts`);
          }

          this.stats.failed++;
        } else {
          // Success
          this.channel.ack(msg);
          this.updateMessage(msgId, { status: 'completed' });
          this.stats.processed++;
          this.attemptCounts.delete(msgId);
          this.logger.log(`Message ${msgId}: processed successfully (attempt ${totalAttempts})`);
        }
      },
      { noAck: false },
    );

    // Consume from DLQ (just for tracking)
    await this.channel.consume(
      this.DLQ_QUEUE,
      (msg) => {
        if (!msg) return;
        this.channel.ack(msg);
        // Message already tracked via nack above
      },
      { noAck: false },
    );
  }

  async stopConsuming(): Promise<void> {
    this.consuming = false;
    // Cancel consumers by purging channel — simplest approach for demo
    await this.channel.close();
    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(1);
    await this.setupQueues();
  }

  async sendMessage(payload: Record<string, unknown>): Promise<DlqMessage> {
    const id = `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const message: DlqMessage = {
      id,
      payload,
      status: 'processing',
      queue: this.MAIN_QUEUE,
      retryCount: 0,
      maxRetries: this.currentConfig.maxRetries,
      createdAt: new Date().toISOString(),
      retryHistory: [],
    };

    this.messages.unshift(message);
    if (this.messages.length > 50) {
      this.messages = this.messages.slice(0, 50);
    }

    const content = JSON.stringify({ id, ...payload, timestamp: new Date().toISOString() });
    this.channel.sendToQueue(this.MAIN_QUEUE, Buffer.from(content), {
      persistent: true,
      headers: { 'x-retry-count': 0 },
    });

    return message;
  }

  async sendBatch(
    count: number,
    payload: Record<string, unknown>,
  ): Promise<{ sent: number; ids: string[] }> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const msg = await this.sendMessage({
        ...payload,
        batchIndex: i + 1,
        batchTotal: count,
      });
      ids.push(msg.id);
    }
    return { sent: count, ids };
  }

  async retryDeadMessage(msgId: string): Promise<boolean> {
    const msg = this.getMessage(msgId);
    if (!msg || msg.status !== 'dead') return false;

    // Reset and resend
    this.attemptCounts.delete(msgId);
    msg.status = 'processing';
    msg.retryCount = 0;
    msg.deadAt = undefined;
    msg.error = undefined;
    msg.retryHistory.push({
      attempt: 0,
      timestamp: new Date().toISOString(),
      delayMs: 0,
      error: 'MANUAL RETRY from DLQ',
    });

    const content = JSON.stringify({
      id: msgId,
      ...msg.payload,
      timestamp: new Date().toISOString(),
    });
    this.channel.sendToQueue(this.MAIN_QUEUE, Buffer.from(content), {
      persistent: true,
      headers: { 'x-retry-count': 0 },
    });

    return true;
  }

  async retryAllDead(): Promise<number> {
    const deadMessages = this.messages.filter((m) => m.status === 'dead');
    let count = 0;
    for (const msg of deadMessages) {
      const ok = await this.retryDeadMessage(msg.id);
      if (ok) count++;
    }
    return count;
  }

  discardDeadMessage(msgId: string): boolean {
    const idx = this.messages.findIndex(
      (m) => m.id === msgId && m.status === 'dead',
    );
    if (idx === -1) return false;
    this.messages.splice(idx, 1);
    this.attemptCounts.delete(msgId);
    return true;
  }

  discardAllDead(): number {
    const before = this.messages.length;
    this.messages = this.messages.filter((m) => m.status !== 'dead');
    return before - this.messages.length;
  }

  getMessages(): DlqMessage[] {
    return this.messages;
  }

  getMessage(id: string): DlqMessage | undefined {
    return this.messages.find((m) => m.id === id);
  }

  async getStats(): Promise<DlqStats> {
    const mainStats = await this.safeQueueStats(this.MAIN_QUEUE);
    const dlqStats = await this.safeQueueStats(this.DLQ_QUEUE);

    const retryQueues: DlqStats['retryQueues'] = [];
    for (let i = 0; i < this.RETRY_DELAYS.length; i++) {
      const name = `dlq-demo.retry.${i + 1}`;
      const stats = await this.safeQueueStats(name);
      retryQueues.push({
        name,
        ttlMs: this.RETRY_DELAYS[i],
        messages: stats.messageCount,
      });
    }

    return {
      mainQueue: {
        messages: mainStats.messageCount,
        consumers: mainStats.consumerCount,
      },
      retryQueues,
      dlq: { messages: dlqStats.messageCount },
      processed: this.stats.processed,
      failed: this.stats.failed,
      retried: this.stats.retried,
      deadLettered: this.stats.deadLettered,
    };
  }

  isConsuming(): boolean {
    return this.consuming;
  }

  clearAll(): void {
    this.messages = [];
    this.stats = { processed: 0, failed: 0, retried: 0, deadLettered: 0 };
    this.attemptCounts.clear();
  }

  private shouldFail(msgId: string, attempt: number): boolean {
    switch (this.currentConfig.failureMode) {
      case 'always':
        return true;
      case 'never':
        return false;
      case 'random':
        return Math.random() < (this.currentConfig.failProbability ?? 0.5);
      case 'first_n': {
        const failCount = this.currentConfig.failCount ?? 2;
        return attempt <= failCount;
      }
    }
  }

  private getFailureReason(attempt: number): string {
    const reasons = [
      'Connection timeout to payment gateway',
      'Database deadlock detected',
      'External API returned 503 Service Unavailable',
      'Rate limit exceeded (429)',
      'Serialization error: invalid JSON payload',
      'Upstream dependency circuit breaker OPEN',
    ];
    return reasons[(attempt - 1) % reasons.length];
  }

  private updateMessage(id: string, partial: Partial<DlqMessage>): void {
    const msg = this.messages.find((m) => m.id === id);
    if (msg) Object.assign(msg, partial);
  }

  private async safeQueueStats(
    queue: string,
  ): Promise<{ messageCount: number; consumerCount: number }> {
    try {
      const result = await this.channel.checkQueue(queue);
      return {
        messageCount: result.messageCount,
        consumerCount: result.consumerCount,
      };
    } catch {
      return { messageCount: 0, consumerCount: 0 };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
