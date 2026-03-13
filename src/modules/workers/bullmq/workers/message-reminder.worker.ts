import { ChatService } from '@/modules/admin/chat/chat.service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';

export interface MessageReminderJobData {
  reminderId: string;
}

@Injectable()
export class MessageReminderWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageReminderWorker.name);
  private worker: Worker;
  private connection: Redis;

  constructor(private readonly chatService: ChatService) {}

  onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<MessageReminderJobData>(
      'message-reminders',
      async (job: Job<MessageReminderJobData>) => this.processJob(job),
      { connection: this.connection, concurrency: 10 },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Reminder job ${job.id} completed.`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Reminder job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('MessageReminderWorker started');
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.connection.quit();
  }

  private async processJob(job: Job<MessageReminderJobData>): Promise<void> {
    const { reminderId } = job.data;
    this.logger.log(`Firing reminder ${reminderId}`);
    await this.chatService.fireReminder(reminderId);
  }
}
