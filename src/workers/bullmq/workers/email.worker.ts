import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  template?: string;
  attachments?: Array<{ filename: string; path: string }>;
}

export interface EmailJobResult {
  success: boolean;
  messageId?: string;
  sentAt?: string;
  error?: string;
}

@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  private worker: Worker;
  private connection: Redis;

  onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<EmailJobData, EmailJobResult>(
      'emails', // Queue name
      async (job) => this.processJob(job),
      {
        connection: this.connection,
        concurrency: 5, // Process 5 jobs simultaneously
        limiter: {
          max: 100, // Max 100 jobs
          duration: 60000, // Per minute (rate limiting)
        },
      },
    );

    // Event handlers
    this.worker.on(
      'completed',
      (job: Job<EmailJobData>, result: EmailJobResult) => {
        this.logger.log(
          `✓ Email job ${job.id} completed: ${JSON.stringify(result)}`,
        );
      },
    );

    this.worker.on('failed', (job: Job<EmailJobData>, err: Error) => {
      this.logger.error(`✗ Email job ${job?.id} failed: ${err.message}`);
    });

    this.worker.on('progress', (job: Job<EmailJobData>, progress: number) => {
      this.logger.log(`Email job ${job.id} progress: ${progress}%`);
    });

    this.worker.on('error', (err: Error) => {
      this.logger.error('Worker error:', err);
    });

    this.logger.log(
      'Email worker started (concurrency: 5, rate limit: 100/min)',
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.connection.quit();
    this.logger.log('Email worker stopped');
  }

  /**
   * Process an email job
   */
  private async processJob(job: Job<EmailJobData>): Promise<EmailJobResult> {
    const { to, subject, body, template } = job.data;

    this.logger.log(`Processing email job ${job.id}: ${subject} → ${to}`);

    try {
      // Update progress
      await job.updateProgress(10);

      // Simulate email preparation
      await this.sleep(100);
      await job.updateProgress(30);

      // Simulate template rendering (if template provided)
      if (template) {
        this.logger.log(`Using template: ${template}`);
        await this.sleep(100);
      }
      await job.updateProgress(50);

      // Simulate sending email
      await this.sendEmail(to, subject, body);
      await job.updateProgress(90);

      // Simulate cleanup
      await this.sleep(50);
      await job.updateProgress(100);

      const result: EmailJobResult = {
        success: true,
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sentAt: new Date().toISOString(),
      };

      this.logger.log(`Email sent successfully to ${to}`);
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);

      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Simulate sending email (replace with real email service)
   */
  private async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    // In real implementation, use nodemailer, SendGrid, AWS SES, etc.
    this.logger.log(`[SIMULATED] Sending email:`);
    this.logger.log(`  To: ${to}`);
    this.logger.log(`  Subject: ${subject}`);
    this.logger.log(`  Body: ${body.substring(0, 50)}...`);

    // Simulate network delay
    await this.sleep(Math.random() * 500 + 200);

    // Simulate occasional failures (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('Simulated email send failure');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
