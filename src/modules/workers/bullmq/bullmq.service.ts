import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue, QueueEvents, Job, JobsOptions } from 'bullmq';
import Redis from 'ioredis';

export type JobData = Record<string, any> | object;

export interface JobResult {
  jobId: string;
  name: string;
  data: JobData;
  status: string;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

@Injectable()
export class BullmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullmqService.name);
  private connection: Redis;
  private queues: Map<string, Queue> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    this.connection.on('connect', () => {
      this.logger.log('BullMQ Redis connection established');
    });

    this.connection.on('error', (err) => {
      this.logger.error('BullMQ Redis connection error:', err);
    });
  }

  async onModuleDestroy() {
    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.log(`Closed queue: ${name}`);
    }

    // Close all queue events
    for (const [name, events] of this.queueEvents) {
      await events.close();
      this.logger.log(`Closed queue events: ${name}`);
    }

    await this.connection.quit();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // QUEUE MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get or create a queue
   */
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, { connection: this.connection });
      this.queues.set(name, queue);
      this.logger.log(`Created queue: ${name}`);
    }
    return this.queues.get(name)!;
  }

  /**
   * Get queue events (for monitoring)
   */
  getQueueEvents(name: string): QueueEvents {
    if (!this.queueEvents.has(name)) {
      const events = new QueueEvents(name, { connection: this.connection });
      this.queueEvents.set(name, events);
    }
    return this.queueEvents.get(name)!;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JOB OPERATIONS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Add a job to a queue
   */
  async addJob(
    queueName: string,
    jobName: string,
    data: JobData,
    options?: JobsOptions,
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, {
      removeOnComplete: true,
      removeOnFail: 100, // Keep last 100 failed jobs
      ...options,
    });

    this.logger.log(`Added job ${job.id} (${jobName}) to queue: ${queueName}`);
    return job;
  }

  /**
   * Add a delayed job
   */
  async addDelayedJob(
    queueName: string,
    jobName: string,
    data: JobData,
    delayMs: number,
  ): Promise<Job> {
    return this.addJob(queueName, jobName, data, { delay: delayMs });
  }

  /**
   * Add a scheduled/repeating job
   */
  async addRepeatingJob(
    queueName: string,
    jobName: string,
    data: JobData,
    pattern: string, // Cron pattern
  ): Promise<Job> {
    return this.addJob(queueName, jobName, data, {
      repeat: { pattern },
    });
  }

  /**
   * Add a job with retry options
   */
  async addJobWithRetry(
    queueName: string,
    jobName: string,
    data: JobData,
    attempts: number = 3,
  ): Promise<Job> {
    return this.addJob(queueName, jobName, data, {
      attempts,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s, 2s, 4s...
      },
    });
  }

  /**
   * Add a priority job
   */
  async addPriorityJob(
    queueName: string,
    jobName: string,
    data: JobData,
    priority: number, // Lower = higher priority
  ): Promise<Job> {
    return this.addJob(queueName, jobName, data, { priority });
  }

  /**
   * Get a job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: string, jobId: string): Promise<string | null> {
    const job = await this.getJob(queueName, jobId);
    if (!job) return null;
    return job.getState();
  }

  /**
   * Remove a job
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // QUEUE STATISTICS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed, isPaused] =
      await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  /**
   * Get all jobs in a state
   */
  async getJobs(
    queueName: string,
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    start = 0,
    end = 10,
  ): Promise<Job[]> {
    const queue = this.getQueue(queueName);
    return queue.getJobs([status], start, end);
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(queueName: string, limit = 10): Promise<Job[]> {
    return this.getJobs(queueName, 'failed', 0, limit - 1);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // QUEUE CONTROL
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    this.logger.log(`Paused queue: ${queueName}`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    this.logger.log(`Resumed queue: ${queueName}`);
  }

  /**
   * Drain a queue (remove all waiting jobs)
   */
  async drainQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
    this.logger.log(`Drained queue: ${queueName}`);
  }

  /**
   * Obliterate a queue (remove all jobs and data)
   */
  async obliterateQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.obliterate({ force: true });
    this.queues.delete(queueName);
    this.logger.log(`Obliterated queue: ${queueName}`);
  }

  /**
   * Retry all failed jobs
   */
  async retryFailedJobs(queueName: string): Promise<number> {
    const failedJobs = await this.getFailedJobs(queueName, 1000);
    let retried = 0;

    for (const job of failedJobs) {
      await job.retry();
      retried++;
    }

    this.logger.log(`Retried ${retried} failed jobs in queue: ${queueName}`);
    return retried;
  }

  /**
   * Get Redis connection status
   */
  isConnected(): boolean {
    return this.connection.status === 'ready';
  }
}
