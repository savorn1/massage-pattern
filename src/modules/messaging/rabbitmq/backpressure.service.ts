import { Injectable, Logger } from '@nestjs/common';

export type BackpressureStrategy = 'block' | 'drop' | 'reject';
export type DropPolicy = 'oldest' | 'newest';

export interface BackpressureConfig {
  producerRatePerSec: number;   // messages produced per second
  consumerRatePerSec: number;   // messages consumed per second
  maxQueueDepth: number;        // max queue size before overflow
  strategy: BackpressureStrategy;
  dropPolicy: DropPolicy;       // used only when strategy = 'drop'
  prefetchCount: number;        // simulated RabbitMQ prefetch / consumer channel limit
}

export interface Message {
  id: string;
  payload: string;
  producedAt: string;
  processedAt?: string;
  droppedAt?: string;
  status: 'queued' | 'processing' | 'done' | 'dropped' | 'rejected';
  waitMs?: number;
}

export interface BackpressureStats {
  isRunning: boolean;
  queueDepth: number;
  maxQueueDepth: number;
  produced: number;
  consumed: number;
  dropped: number;
  rejected: number;
  blocked: number;         // times producer was slowed (block strategy)
  throughputProduced: number;  // per second (rolling)
  throughputConsumed: number;  // per second (rolling)
  avgWaitMs: number;
  config: BackpressureConfig;
}

@Injectable()
export class BackpressureService {
  private readonly logger = new Logger(BackpressureService.name);

  private queue: Message[] = [];
  private messageLog: Message[] = [];  // last 200 messages (done/dropped/rejected)
  private isRunning = false;

  private producerTimer?: ReturnType<typeof setInterval>;
  private consumerTimer?: ReturnType<typeof setInterval>;

  private stats = {
    produced: 0,
    consumed: 0,
    dropped: 0,
    rejected: 0,
    blocked: 0,
    waitMs: [] as number[],
  };

  // Rolling window for throughput calc
  private producedTimes: number[] = [];
  private consumedTimes: number[] = [];

  private config: BackpressureConfig = {
    producerRatePerSec: 10,
    consumerRatePerSec: 3,
    maxQueueDepth: 20,
    strategy: 'drop',
    dropPolicy: 'oldest',
    prefetchCount: 1,
  };

  // ─── Control ─────────────────────────────────────────────────────────────

  start(cfg?: Partial<BackpressureConfig>): void {
    if (this.isRunning) return;

    if (cfg) {
      this.config = { ...this.config, ...cfg };
    }

    this.isRunning = true;
    this.logger.log(`[BP] Starting — producer: ${this.config.producerRatePerSec}/s, consumer: ${this.config.consumerRatePerSec}/s, strategy: ${this.config.strategy}`);

    this.startProducer();
    this.startConsumer();
  }

  stop(): void {
    this.isRunning = false;
    if (this.producerTimer) clearInterval(this.producerTimer);
    if (this.consumerTimer) clearInterval(this.consumerTimer);
    this.producerTimer = undefined;
    this.consumerTimer = undefined;
    this.logger.log('[BP] Stopped');
  }

  clear(): void {
    this.stop();
    this.queue = [];
    this.messageLog = [];
    this.stats = { produced: 0, consumed: 0, dropped: 0, rejected: 0, blocked: 0, waitMs: [] };
    this.producedTimes = [];
    this.consumedTimes = [];
    this.logger.log('[BP] Cleared');
  }

  updateConfig(partial: Partial<BackpressureConfig>): void {
    const wasRunning = this.isRunning;
    if (wasRunning) this.stop();
    this.config = { ...this.config, ...partial };
    if (wasRunning) this.start();
    this.logger.log(`[BP] Config updated: ${JSON.stringify(partial)}`);
  }

  // ─── Producer ────────────────────────────────────────────────────────────

  private startProducer(): void {
    const intervalMs = 1000 / this.config.producerRatePerSec;
    let seq = this.stats.produced;

    this.producerTimer = setInterval(() => {
      if (!this.isRunning) return;
      seq++;
      this.produce(`Order-${seq.toString().padStart(4, '0')}`);
    }, intervalMs);
  }

  private produce(payload: string): void {
    const msg: Message = {
      id: `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      payload,
      producedAt: new Date().toISOString(),
      status: 'queued',
    };

    this.stats.produced++;
    this.producedTimes.push(Date.now());
    this.trimWindow(this.producedTimes);

    if (this.queue.length >= this.config.maxQueueDepth) {
      this.handleOverflow(msg);
      return;
    }

    this.queue.push(msg);
    this.logger.debug(`[BP] Produced ${msg.id} | queue: ${this.queue.length}`);
  }

  private handleOverflow(msg: Message): void {
    switch (this.config.strategy) {
      case 'drop': {
        if (this.config.dropPolicy === 'oldest') {
          // Drop oldest item in queue to make room
          const dropped = this.queue.shift();
          if (dropped) {
            dropped.status = 'dropped';
            dropped.droppedAt = new Date().toISOString();
            this.addToLog(dropped);
            this.stats.dropped++;
            this.logger.warn(`[BP] DROPPED (oldest) ${dropped.id}`);
          }
          this.queue.push(msg);
        } else {
          // Drop the incoming (newest)
          msg.status = 'dropped';
          msg.droppedAt = new Date().toISOString();
          this.addToLog(msg);
          this.stats.dropped++;
          this.logger.warn(`[BP] DROPPED (newest) ${msg.id}`);
        }
        break;
      }

      case 'reject': {
        msg.status = 'rejected';
        msg.droppedAt = new Date().toISOString();
        this.addToLog(msg);
        this.stats.rejected++;
        this.logger.warn(`[BP] REJECTED ${msg.id} (429 — queue full)`);
        break;
      }

      case 'block': {
        // Slow down: just don't enqueue now but count as blocked
        // The message is queued anyway once there's room (simplified: we re-add a delay)
        this.stats.blocked++;
        this.logger.warn(`[BP] BLOCKED producer — queue full (${this.queue.length})`);
        // Re-attempt after a short delay (simulates producer waiting)
        setTimeout(() => {
          if (this.queue.length < this.config.maxQueueDepth) {
            this.queue.push(msg);
          } else {
            // Give up after one retry (prevent runaway accumulation)
            msg.status = 'dropped';
            msg.droppedAt = new Date().toISOString();
            this.addToLog(msg);
            this.stats.dropped++;
          }
        }, 500);
        break;
      }
    }
  }

  // ─── Consumer ────────────────────────────────────────────────────────────

  private startConsumer(): void {
    const intervalMs = 1000 / this.config.consumerRatePerSec;

    this.consumerTimer = setInterval(() => {
      if (!this.isRunning) return;

      // Simulate prefetchCount: consume up to prefetchCount messages per tick
      const batch = Math.min(this.config.prefetchCount, this.queue.length);
      for (let i = 0; i < batch; i++) {
        const msg = this.queue.shift();
        if (!msg) break;
        this.consume(msg);
      }
    }, intervalMs);
  }

  private consume(msg: Message): void {
    msg.status = 'done';
    msg.processedAt = new Date().toISOString();
    msg.waitMs = new Date(msg.processedAt).getTime() - new Date(msg.producedAt).getTime();

    this.stats.consumed++;
    this.stats.waitMs.push(msg.waitMs);
    if (this.stats.waitMs.length > 200) this.stats.waitMs = this.stats.waitMs.slice(-200);

    this.consumedTimes.push(Date.now());
    this.trimWindow(this.consumedTimes);

    this.addToLog(msg);
    this.logger.debug(`[BP] Consumed ${msg.id} (wait: ${msg.waitMs}ms)`);
  }

  // ─── Status / Queries ────────────────────────────────────────────────────

  getStats(): BackpressureStats {
    const now = Date.now();
    const window = 3000; // 3-second rolling window

    const recentProduced = this.producedTimes.filter((t) => now - t < window).length;
    const recentConsumed = this.consumedTimes.filter((t) => now - t < window).length;

    const avgWaitMs =
      this.stats.waitMs.length > 0
        ? Math.round(this.stats.waitMs.reduce((a, b) => a + b, 0) / this.stats.waitMs.length)
        : 0;

    return {
      isRunning: this.isRunning,
      queueDepth: this.queue.length,
      maxQueueDepth: this.config.maxQueueDepth,
      produced: this.stats.produced,
      consumed: this.stats.consumed,
      dropped: this.stats.dropped,
      rejected: this.stats.rejected,
      blocked: this.stats.blocked,
      throughputProduced: parseFloat((recentProduced / (window / 1000)).toFixed(1)),
      throughputConsumed: parseFloat((recentConsumed / (window / 1000)).toFixed(1)),
      avgWaitMs,
      config: this.config,
    };
  }

  getMessageLog(): Message[] {
    return this.messageLog;
  }

  getQueueSnapshot(): Message[] {
    return [...this.queue];
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private addToLog(msg: Message): void {
    this.messageLog.unshift(msg);
    if (this.messageLog.length > 200) {
      this.messageLog = this.messageLog.slice(0, 200);
    }
  }

  private trimWindow(arr: number[]): void {
    const cutoff = Date.now() - 5000;
    while (arr.length > 0 && arr[0] < cutoff) arr.shift();
  }
}
