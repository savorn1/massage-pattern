import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { FundPoolsService } from '@/modules/admin/fund-pools/fund-pools.service';
import { WebsocketGateway } from '@/modules/messaging/websocket/websocket.gateway';
import { FeatureFlagService } from '@/modules/feature-flags/feature-flag.service';

const QUEUE_NAME = 'fund-pool-executor';
const JOB_NAME = 'execute-fund-pools';
const WS_ROOM = 'fund-pools';
const FLAG_KEY = 'fund-pool-executor';

@Injectable()
export class FundPoolExecutorWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FundPoolExecutorWorker.name);
  private connection: Redis;
  private queue: Queue;
  private worker: Worker;

  constructor(
    private readonly fundPoolsService: FundPoolsService,
    private readonly ws: WebsocketGateway,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  async onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    this.connection.on('error', (err) =>
      this.logger.error('FundPoolExecutor Redis error:', err.message),
    );

    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });

    // Remove stale repeatable jobs from previous runs to prevent duplicates
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Schedule one repeating job — fires every minute via cron
    await this.queue.add(JOB_NAME, {}, {
      repeat: { pattern: '* * * * *' },
      removeOnComplete: true,
      removeOnFail: 5,
    });

    this.worker = new Worker(QUEUE_NAME, async (job) => this.processJob(job), {
      connection: this.connection,
    });

    this.worker.on('completed', (job: Job) =>
      this.logger.log(`✓ Fund pool executor job ${job.id} completed`),
    );

    this.worker.on('failed', (job: Job | undefined, err: Error) =>
      this.logger.error(`✗ Fund pool executor job ${job?.id} failed: ${err.message}`),
    );

    this.logger.log('FundPoolExecutor worker started — checking pools every minute');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
    this.logger.log('FundPoolExecutor worker stopped');
  }

  private async processJob(job: Job): Promise<void> {
    const enabled = await this.featureFlags.isEnabled(FLAG_KEY);
    if (!enabled) {
      this.logger.log('Fund pool executor is disabled via feature flag — skipping');
      return;
    }

    this.logger.log(`Running fund pool executor job ${job.id}`);

    const duePools = await this.fundPoolsService.getDuePools();

    if (!duePools.length) {
      this.logger.log('No fund pools due for execution');
      return;
    }

    this.logger.log(`${duePools.length} fund pool(s) due for execution`);

    for (const pool of duePools) {
      try {
        const poolId = pool._id as unknown as string;
        const updated = await this.fundPoolsService.applyRecurring(poolId);

        // Broadcast real-time update to all clients watching fund pools
        this.ws.broadcastToRoom(WS_ROOM, 'fund-pool:updated', updated.toObject());
      } catch (err) {
        this.logger.error(`Failed to execute pool "${pool.name}": ${(err as Error).message}`);
      }
    }
  }
}
