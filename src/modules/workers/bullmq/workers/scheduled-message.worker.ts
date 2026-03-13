import { ChatService } from '@/modules/admin/chat/chat.service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';

export interface ScheduledMessageJobData {
  scheduledMessageId: string;
}

@Injectable()
export class ScheduledMessageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledMessageWorker.name);
  private worker: Worker;
  private connection: Redis;

  constructor(private readonly chatService: ChatService) {}

  onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<ScheduledMessageJobData>(
      'scheduled-messages',
      async (job: Job<ScheduledMessageJobData>) => this.processJob(job),
      { connection: this.connection, concurrency: 10 },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Scheduled message job ${job.id} completed.`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Scheduled message job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('ScheduledMessageWorker started');
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.connection.quit();
  }

  private async processJob(job: Job<ScheduledMessageJobData>): Promise<void> {
    const { scheduledMessageId } = job.data;
    this.logger.log(`Sending scheduled message ${scheduledMessageId}`);
    await this.chatService.sendScheduledMessage(scheduledMessageId);
  }
}
