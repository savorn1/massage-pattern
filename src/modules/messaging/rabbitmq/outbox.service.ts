import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

// ─── Simulated DB rows ──────────────────────────────────────────────────────

export interface OrderRow {
  id: string;
  customer: string;
  amount: number;
  items: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export type OutboxStatus = 'pending' | 'published' | 'failed';

export interface OutboxRow {
  id: string;
  orderId: string;
  topic: string;        // RabbitMQ routing key
  payload: Record<string, unknown>;
  status: OutboxStatus;
  retryCount: number;
  createdAt: string;
  publishedAt?: string;
  lastError?: string;
}

export interface RelayStats {
  running: boolean;
  brokerDown: boolean;
  pollCount: number;
  publishedCount: number;
  failedCount: number;
  lastPollAt?: string;
  pendingCount: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private connection!: amqp.Connection;
  private channel!: amqp.Channel;

  // Simulated DB tables (in-memory)
  private orders: OrderRow[] = [];
  private outbox: OutboxRow[] = [];

  // Relay state
  private relayTimer: ReturnType<typeof setInterval> | null = null;
  private brokerDown = false;        // simulated outage toggle
  private relayRunning = false;
  private pollCount = 0;
  private publishedCount = 0;
  private failedCount = 0;
  private lastPollAt?: string;

  // Published messages log (what consumers would receive)
  private publishedMessages: {
    id: string;
    topic: string;
    payload: Record<string, unknown>;
    publishedAt: string;
  }[] = [];

  private readonly EXCHANGE = 'outbox.events';
  private readonly RELAY_INTERVAL_MS = 1000;

  async onModuleInit() {
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      );
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue('outbox.orders', { durable: true });
      await this.channel.bindQueue('outbox.orders', this.EXCHANGE, 'order.*');
      this.logger.log('Outbox exchange and queues initialized');
    } catch (err) {
      this.logger.error('Failed to initialize outbox RabbitMQ:', err);
    }
  }

  async onModuleDestroy() {
    this.stopRelay();
    await this.channel?.close();
    await this.connection?.close();
  }

  // ─── Simulated "DB Transaction" ─────────────────────────────────────────

  /**
   * Atomically creates an order AND its outbox entry.
   * In a real app this would be a DB transaction:
   *   BEGIN
   *     INSERT INTO orders ...
   *     INSERT INTO outbox ...
   *   COMMIT
   *
   * Here we simulate it in-memory. The key guarantee:
   *   Both rows are written together, or neither is.
   */
  createOrder(dto: {
    customer: string;
    amount: number;
    items: number;
  }): { order: OrderRow; outboxEntry: OutboxRow } {
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const now = new Date().toISOString();

    // ── Simulate transaction BEGIN ───────────────────────────────────────
    const order: OrderRow = {
      id: orderId,
      customer: dto.customer,
      amount: dto.amount,
      items: dto.items,
      status: 'pending',
      createdAt: now,
    };

    const outboxEntry: OutboxRow = {
      id: `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      orderId,
      topic: 'order.created',
      payload: {
        orderId,
        customer: dto.customer,
        amount: dto.amount,
        items: dto.items,
        timestamp: now,
      },
      status: 'pending',
      retryCount: 0,
      createdAt: now,
    };

    // ── Simulate transaction COMMIT ───────────────────────────────────────
    // Both writes happen here — atomically in a real DB
    this.orders.unshift(order);
    this.outbox.unshift(outboxEntry);

    // Keep last 50
    if (this.orders.length > 50) this.orders = this.orders.slice(0, 50);
    if (this.outbox.length > 100) this.outbox = this.outbox.slice(0, 100);

    this.logger.log(
      `[TX COMMIT] Order ${orderId} + Outbox ${outboxEntry.id} written atomically`,
    );

    return { order, outboxEntry };
  }

  createOrderBatch(
    count: number,
    dto: { customer: string; amount: number; items: number },
  ): { orders: OrderRow[]; outboxEntries: OutboxRow[] } {
    const orders: OrderRow[] = [];
    const outboxEntries: OutboxRow[] = [];
    for (let i = 0; i < count; i++) {
      const result = this.createOrder({
        ...dto,
        customer: `${dto.customer} #${i + 1}`,
        amount: +(dto.amount + i * 10).toFixed(2),
      });
      orders.push(result.order);
      outboxEntries.push(result.outboxEntry);
    }
    return { orders, outboxEntries };
  }

  // ─── Relay ───────────────────────────────────────────────────────────────

  startRelay(): void {
    if (this.relayRunning) return;
    this.relayRunning = true;
    this.relayTimer = setInterval(() => this.runRelayPoll(), this.RELAY_INTERVAL_MS);
    this.logger.log('Outbox relay started');
  }

  stopRelay(): void {
    if (this.relayTimer) {
      clearInterval(this.relayTimer);
      this.relayTimer = null;
    }
    this.relayRunning = false;
    this.logger.log('Outbox relay stopped');
  }

  private async runRelayPoll(): Promise<void> {
    this.pollCount++;
    this.lastPollAt = new Date().toISOString();

    // SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at
    const pending = this.outbox
      .filter((m) => m.status === 'pending')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (pending.length === 0) return;

    this.logger.debug(`Relay poll #${this.pollCount}: ${pending.length} pending`);

    for (const entry of pending) {
      if (this.brokerDown) {
        // Broker is "down" — can't publish, leave as pending
        entry.retryCount++;
        entry.lastError = 'Broker unavailable (simulated outage)';
        this.failedCount++;
        this.logger.warn(`Relay: broker down, skipping ${entry.id}`);
        continue;
      }

      try {
        // Publish to RabbitMQ
        if (!this.channel) throw new Error('Channel not initialized');

        this.channel.publish(
          this.EXCHANGE,
          entry.topic,
          Buffer.from(JSON.stringify(entry.payload)),
          {
            persistent: true,
            messageId: entry.id,
            timestamp: Date.now(),
            headers: { 'x-outbox-id': entry.id, 'x-order-id': entry.orderId },
          },
        );

        // UPDATE outbox SET status = 'published', published_at = NOW()
        entry.status = 'published';
        entry.publishedAt = new Date().toISOString();
        entry.lastError = undefined;

        // Track published messages for display
        this.publishedMessages.unshift({
          id: entry.id,
          topic: entry.topic,
          payload: entry.payload,
          publishedAt: entry.publishedAt,
        });
        if (this.publishedMessages.length > 50) {
          this.publishedMessages = this.publishedMessages.slice(0, 50);
        }

        this.publishedCount++;
        this.logger.log(`Relay: published ${entry.id} → ${entry.topic}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        entry.retryCount++;
        entry.lastError = message;
        this.failedCount++;
        this.logger.error(`Relay: failed to publish ${entry.id}: ${message}`);
      }
    }
  }

  // ─── Broker Simulation ───────────────────────────────────────────────────

  setBrokerDown(down: boolean): void {
    this.brokerDown = down;
    this.logger.log(`Broker simulation: ${down ? 'DOWN' : 'UP'}`);
  }

  isBrokerDown(): boolean {
    return this.brokerDown;
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  getOrders(): OrderRow[] {
    return this.orders;
  }

  getOutbox(): OutboxRow[] {
    return this.outbox;
  }

  getPublishedMessages() {
    return this.publishedMessages;
  }

  getRelayStats(): RelayStats {
    return {
      running: this.relayRunning,
      brokerDown: this.brokerDown,
      pollCount: this.pollCount,
      publishedCount: this.publishedCount,
      failedCount: this.failedCount,
      lastPollAt: this.lastPollAt,
      pendingCount: this.outbox.filter((m) => m.status === 'pending').length,
    };
  }

  clearAll(): void {
    this.orders = [];
    this.outbox = [];
    this.publishedMessages = [];
    this.pollCount = 0;
    this.publishedCount = 0;
    this.failedCount = 0;
    this.lastPollAt = undefined;
  }
}
