import { Injectable, Logger } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';

export interface LoadTestConfig {
  numClients: number;
  room: string;
  messagesPerSecond: number;
  durationSeconds: number;
  serverUrl?: string;
  serverUrls?: string[];
  batchSize?: number;
  rampUpSeconds?: number;
  transport?: 'redis' | 'nats';
}

export interface SpikeTestConfig {
  room: string;
  messagesPerSecond: number;
  serverUrl?: string;
  baseClients: number;
  spikeClients: number;
  baseSeconds: number;
  spikeSeconds: number;
  recoverySeconds: number;
  transport?: 'redis' | 'nats';
}

export type SpikePhase = 'base' | 'spike' | 'hold' | 'drop' | 'recovery' | 'done';

interface PhaseStats {
  phase: SpikePhase;
  clients: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errors: number;
  messagesReceived: number;
}

export interface LoadTestStats {
  isRunning: boolean;
  connectedClients: number;
  targetClients: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  messagesPerSecond: number;
  elapsedSeconds: number;
  durationSeconds: number;
  errors: number;
  room: string;
  serverUrls: string[];
  memoryUsageMB: number;
  transport: 'redis' | 'nats';
  spikePhase?: SpikePhase;
  spikePhaseElapsed?: number;
  spikeConfig?: SpikeTestConfig;
  phaseStats?: PhaseStats[];
}

@Injectable()
export class LoadTestService {
  private readonly logger = new Logger(LoadTestService.name);

  private clients: Socket[] = [];
  private isRunning = false;
  private messageInterval: NodeJS.Timeout | null = null;
  private durationTimeout: NodeJS.Timeout | null = null;

  // Stats tracking
  private totalMessagesSent = 0;
  private totalMessagesReceived = 0;
  private latencies: number[] = [];
  private errors = 0;
  private startTime: Date | null = null;
  private config: LoadTestConfig | null = null;

  // Spike test tracking
  private spikePhase: SpikePhase | null = null;
  private spikePhaseStart: Date | null = null;
  private spikeConfig: SpikeTestConfig | null = null;
  private phaseStats: PhaseStats[] = [];

  getStats(): LoadTestStats {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const avg =
      sorted.length > 0
        ? sorted.reduce((sum, l) => sum + l, 0) / sorted.length
        : 0;

    const elapsed = this.startTime
      ? (Date.now() - this.startTime.getTime()) / 1000
      : 0;

    const memUsage = process.memoryUsage();

    const spikePhaseElapsed = this.spikePhaseStart
      ? (Date.now() - this.spikePhaseStart.getTime()) / 1000
      : 0;

    return {
      isRunning: this.isRunning,
      connectedClients: this.clients.filter((c) => c.connected).length,
      targetClients: this.config?.numClients || 0,
      totalMessagesSent: this.totalMessagesSent,
      totalMessagesReceived: this.totalMessagesReceived,
      avgLatencyMs: Math.round(avg * 100) / 100,
      maxLatencyMs: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      minLatencyMs: sorted.length > 0 ? sorted[0] : 0,
      p95LatencyMs:
        sorted.length > 0
          ? sorted[Math.floor(sorted.length * 0.95)]
          : 0,
      p99LatencyMs:
        sorted.length > 0
          ? sorted[Math.floor(sorted.length * 0.99)]
          : 0,
      messagesPerSecond:
        elapsed > 0 ? Math.round(this.totalMessagesSent / elapsed) : 0,
      elapsedSeconds: Math.round(elapsed),
      durationSeconds: this.config?.durationSeconds || 0,
      errors: this.errors,
      room: this.config?.room || '',
      serverUrls: this.getServerUrls(),
      memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      transport: this.config?.transport || 'redis',
      spikePhase: this.spikePhase || undefined,
      spikePhaseElapsed: this.spikePhase ? Math.round(spikePhaseElapsed) : undefined,
      spikeConfig: this.spikeConfig || undefined,
      phaseStats: this.phaseStats.length > 0 ? this.phaseStats : undefined,
    };
  }

  private getServerUrls(): string[] {
    if (!this.config) return [];
    if (this.config.serverUrls?.length) return this.config.serverUrls;
    return [this.config.serverUrl || 'http://localhost:3000'];
  }

  async start(config: LoadTestConfig): Promise<{ message: string }> {
    if (this.isRunning) {
      await this.stop();
    }

    const maxInProcess = 2000;
    if (config.numClients > maxInProcess) {
      return {
        message:
          `In-process load test limited to ${maxInProcess} clients. ` +
          `For ${config.numClients}+ clients, use the standalone CLI script:\n` +
          `npx ts-node scripts/load-test.ts --clients ${config.numClients} --room ${config.room} --mps ${config.messagesPerSecond} --duration ${config.durationSeconds}`,
      };
    }

    this.config = config;
    this.resetStats();
    this.isRunning = true;
    this.startTime = new Date();

    const serverUrls = this.getServerUrls();
    const defaultBatchSize =
      config.numClients > 500 ? 20 : config.numClients > 100 ? 30 : 50;
    const batchSize = config.batchSize || Math.min(defaultBatchSize, config.numClients);
    const defaultRampUpSeconds =
      config.numClients >= 1000 ? 10 : config.numClients >= 500 ? 5 : 0;
    const rampUpMs = (config.rampUpSeconds ?? defaultRampUpSeconds) * 1000;
    const batches = Math.ceil(config.numClients / batchSize);
    const batchDelay = rampUpMs > 0 ? rampUpMs / batches : 200;

    this.logger.log(
      `Starting load test: ${config.numClients} clients → ${serverUrls.join(', ')}, ` +
        `room=${config.room}, ${config.messagesPerSecond} msg/s, ${config.durationSeconds}s`,
    );

    await this.connectClients(config.numClients, serverUrls, config.room, batchSize, batchDelay);

    const connected = this.clients.filter((c) => c.connected).length;
    this.logger.log(`${connected}/${config.numClients} clients connected`);

    this.startMessaging(config.messagesPerSecond, config.room);

    if (config.durationSeconds > 0) {
      this.durationTimeout = setTimeout(() => {
        this.stop();
      }, config.durationSeconds * 1000);
    }

    return {
      message: `Load test started: ${connected} clients connected to room "${config.room}" on ${serverUrls.length} server(s)`,
    };
  }

  // --- Spike Test ---

  async startSpike(config: SpikeTestConfig): Promise<{ message: string }> {
    if (this.isRunning) {
      await this.stop();
    }

    const maxInProcess = 2000;
    if (config.spikeClients > maxInProcess) {
      return {
        message: `Spike test limited to ${maxInProcess} spike clients in-process.`,
      };
    }

    const totalDuration = config.baseSeconds + config.spikeSeconds + config.recoverySeconds + 10; // +10 for spike/drop transitions
    this.config = {
      numClients: config.spikeClients,
      room: config.room,
      messagesPerSecond: config.messagesPerSecond,
      durationSeconds: totalDuration,
      serverUrl: config.serverUrl || 'http://localhost:3000',
      transport: config.transport,
    };
    this.spikeConfig = config;
    this.phaseStats = [];
    this.resetStats();
    this.isRunning = true;
    this.startTime = new Date();

    const serverUrl = config.serverUrl || 'http://localhost:3000';

    this.logger.log(
      `Starting spike test: base=${config.baseClients}, spike=${config.spikeClients}, ` +
        `phases: ${config.baseSeconds}s base → spike → ${config.spikeSeconds}s hold → drop → ${config.recoverySeconds}s recovery`,
    );

    // Phase 1: BASE - connect base clients
    await this.enterPhase('base');
    await this.connectClients(config.baseClients, [serverUrl], config.room, 30, 200);
    this.startMessaging(config.messagesPerSecond, config.room);

    let connected = this.clients.filter((c) => c.connected).length;
    this.logger.log(`[BASE] ${connected} clients connected`);

    await this.waitPhase(config.baseSeconds);
    if (!this.isRunning) return { message: 'Spike test stopped' };
    this.capturePhaseStats('base', config.baseClients);

    // Phase 2: SPIKE - rapidly add clients to spike level
    await this.enterPhase('spike');
    const additionalClients = config.spikeClients - config.baseClients;
    this.logger.log(`[SPIKE] Adding ${additionalClients} clients rapidly...`);
    await this.connectClients(additionalClients, [serverUrl], config.room, 50, 50);

    connected = this.clients.filter((c) => c.connected).length;
    this.logger.log(`[SPIKE] ${connected} clients connected`);
    this.capturePhaseStats('spike', config.spikeClients);

    if (!this.isRunning) return { message: 'Spike test stopped' };

    // Phase 3: HOLD - maintain spike load
    await this.enterPhase('hold');
    await this.waitPhase(config.spikeSeconds);
    if (!this.isRunning) return { message: 'Spike test stopped' };
    this.capturePhaseStats('hold', config.spikeClients);

    // Phase 4: DROP - disconnect back to base level
    await this.enterPhase('drop');
    const clientsToRemove = this.clients.length - config.baseClients;
    this.logger.log(`[DROP] Disconnecting ${clientsToRemove} clients...`);
    await this.disconnectClients(clientsToRemove);

    connected = this.clients.filter((c) => c.connected).length;
    this.logger.log(`[DROP] ${connected} clients remaining`);
    this.capturePhaseStats('drop', config.baseClients);

    if (!this.isRunning) return { message: 'Spike test stopped' };

    // Phase 5: RECOVERY - monitor at base load
    await this.enterPhase('recovery');
    await this.waitPhase(config.recoverySeconds);
    this.capturePhaseStats('recovery', config.baseClients);

    // Done
    this.spikePhase = 'done';
    this.logger.log(`[DONE] Spike test complete`);

    await this.stop();

    return {
      message: `Spike test complete. Phases: ${this.phaseStats.map((p) => `${p.phase}(avg=${p.avgLatencyMs}ms)`).join(' → ')}`,
    };
  }

  private async enterPhase(phase: SpikePhase) {
    this.spikePhase = phase;
    this.spikePhaseStart = new Date();
    // Reset latencies for per-phase measurement
    this.latencies = [];
    this.logger.log(`--- Phase: ${phase.toUpperCase()} ---`);
  }

  private capturePhaseStats(phase: SpikePhase, clients: number) {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const avg =
      sorted.length > 0
        ? sorted.reduce((sum, l) => sum + l, 0) / sorted.length
        : 0;
    const p95 =
      sorted.length > 0
        ? sorted[Math.floor(sorted.length * 0.95)]
        : 0;

    this.phaseStats.push({
      phase,
      clients,
      avgLatencyMs: Math.round(avg * 100) / 100,
      p95LatencyMs: p95,
      errors: this.errors,
      messagesReceived: this.totalMessagesReceived,
    });
  }

  private async waitPhase(seconds: number): Promise<void> {
    const interval = 500;
    const total = seconds * 1000;
    let waited = 0;
    while (waited < total && this.isRunning) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      waited += interval;
    }
  }

  private async connectClients(
    count: number,
    serverUrls: string[],
    room: string,
    batchSize: number,
    batchDelay: number,
  ): Promise<void> {
    const batches = Math.ceil(count / batchSize);
    const startIndex = this.clients.length;

    for (let batch = 0; batch < batches; batch++) {
      if (!this.isRunning) break;

      const batchCount = Math.min(batchSize, count - batch * batchSize);
      const promises: Promise<void>[] = [];

      for (let i = 0; i < batchCount; i++) {
        const clientIndex = startIndex + batch * batchSize + i;
        const serverUrl = serverUrls[clientIndex % serverUrls.length];
        promises.push(this.createClient(serverUrl, room, clientIndex));
      }

      await Promise.allSettled(promises);

      if (batch < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
      }
    }
  }

  private async disconnectClients(count: number): Promise<void> {
    const toRemove = Math.min(count, this.clients.length);
    const batchSize = 50;

    for (let i = 0; i < toRemove; i += batchSize) {
      const batchCount = Math.min(batchSize, toRemove - i);
      for (let j = 0; j < batchCount; j++) {
        const client = this.clients.pop();
        if (client) {
          try { client.disconnect(); } catch {}
        }
      }
      if (i + batchSize < toRemove) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  private startMessaging(messagesPerSecond: number, _room?: string) {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
    if (messagesPerSecond > 0) {
      const intervalMs = 1000 / messagesPerSecond;
      this.messageInterval = setInterval(() => {
        this.sendTestMessage();
      }, intervalMs);
    }
  }

  async stop(): Promise<{ message: string; stats: LoadTestStats }> {
    this.isRunning = false;

    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }

    if (this.durationTimeout) {
      clearTimeout(this.durationTimeout);
      this.durationTimeout = null;
    }

    const stats = this.getStats();

    const disconnectBatch = 100;
    for (let i = 0; i < this.clients.length; i += disconnectBatch) {
      const batch = this.clients.slice(i, i + disconnectBatch);
      for (const client of batch) {
        try {
          client.disconnect();
        } catch {
          // ignore
        }
      }
      if (i + disconnectBatch < this.clients.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    this.logger.log(
      `Load test stopped. sent=${stats.totalMessagesSent}, recv=${stats.totalMessagesReceived}, ` +
        `avg=${stats.avgLatencyMs}ms, p95=${stats.p95LatencyMs}ms, p99=${stats.p99LatencyMs}ms`,
    );

    this.clients = [];
    this.spikePhase = null;
    this.spikePhaseStart = null;
    this.spikeConfig = null;

    return { message: 'Load test stopped', stats };
  }

  private async createClient(
    serverUrl: string,
    room: string,
    index: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const client = io(serverUrl, {
        transports: ['websocket'],
        auth: { username: `load-test-${index}` },
        reconnection: false,
        timeout: 10000,
      });

      const connectTimeout = setTimeout(() => {
        this.errors++;
        resolve();
      }, 10000);

      client.on('connect', () => {
        clearTimeout(connectTimeout);
        client.emit('joinRoom', { room });
        resolve();
      });

      client.on('connect_error', () => {
        clearTimeout(connectTimeout);
        this.errors++;
        resolve();
      });

      client.on('load-test:ping', (data: { sentAt: number }) => {
        const latency = Date.now() - data.sentAt;
        this.latencies.push(latency);
        this.totalMessagesReceived++;

        if (this.latencies.length > 5000) {
          this.latencies = this.latencies.slice(-5000);
        }
      });

      for (const event of [
        'task:created',
        'task:updated',
        'task:deleted',
        'project:created',
        'project:updated',
        'redis:test',
      ]) {
        client.on(event, () => {
          this.totalMessagesReceived++;
        });
      }

      this.clients.push(client);
    });
  }

  private sendTestMessage() {
    if (!this.isRunning || !this.config) return;

    const connectedClients = this.clients.filter((c) => c.connected);
    if (connectedClients.length === 0) return;

    const client =
      connectedClients[Math.floor(Math.random() * connectedClients.length)];

    client.emit('roomMessage', {
      room: this.config.room,
      event: 'load-test:ping',
      data: { sentAt: Date.now() },
    });

    this.totalMessagesSent++;
  }

  private resetStats() {
    this.totalMessagesSent = 0;
    this.totalMessagesReceived = 0;
    this.latencies = [];
    this.errors = 0;
    this.startTime = null;
    this.spikePhase = null;
    this.spikePhaseStart = null;
    this.phaseStats = [];
  }
}
