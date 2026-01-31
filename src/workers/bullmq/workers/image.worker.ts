import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

export interface ImageJobData {
  imageId: string;
  source: string;
  operations: Array<{
    type: 'resize' | 'crop' | 'compress' | 'watermark' | 'convert';
    params: Record<string, unknown>;
  }>;
  outputFormat?: 'jpg' | 'png' | 'webp';
}

export interface ImageJobResult {
  success: boolean;
  imageId: string;
  outputPath?: string;
  originalSize?: number;
  processedSize?: number;
  processingTime?: number;
  error?: string;
}

@Injectable()
export class ImageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImageWorker.name);
  private worker: Worker;
  private connection: Redis;

  onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<ImageJobData, ImageJobResult>(
      'images',
      async (job) => this.processJob(job),
      {
        connection: this.connection,
        concurrency: 3, // Image processing is CPU intensive
      },
    );

    this.worker.on(
      'completed',
      (job: Job<ImageJobData>, result: ImageJobResult) => {
        this.logger.log(
          `✓ Image job ${job.id} completed: ${result.outputPath}`,
        );
      },
    );

    this.worker.on('failed', (job: Job<ImageJobData>, err: Error) => {
      this.logger.error(`✗ Image job ${job?.id} failed: ${err.message}`);
    });

    this.worker.on('progress', (job: Job<ImageJobData>, progress: number) => {
      this.logger.log(`Image job ${job.id} progress: ${progress}%`);
    });

    this.logger.log('Image worker started (concurrency: 3)');
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.connection.quit();
    this.logger.log('Image worker stopped');
  }

  private async processJob(job: Job<ImageJobData>): Promise<ImageJobResult> {
    const { imageId, source, operations, outputFormat } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `Processing image ${imageId}: ${operations.length} operations`,
    );

    try {
      await job.updateProgress(10);

      // Simulate loading image
      this.logger.log(`Loading image from: ${source}`);
      await this.sleep(200);
      await job.updateProgress(20);

      // Process each operation
      const totalOps = operations.length;
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        this.logger.log(`Applying ${op.type}: ${JSON.stringify(op.params)}`);

        await this.applyOperation(op.type, op.params);

        const progress = 20 + Math.floor(((i + 1) / totalOps) * 60);
        await job.updateProgress(progress);
      }

      // Simulate saving
      const outputPath = `/processed/${imageId}.${outputFormat || 'jpg'}`;
      this.logger.log(`Saving to: ${outputPath}`);
      await this.sleep(150);
      await job.updateProgress(90);

      // Cleanup
      await this.sleep(50);
      await job.updateProgress(100);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        imageId,
        outputPath,
        originalSize: 1024000, // Simulated
        processedSize: 512000, // Simulated
        processingTime,
      };
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        imageId,
        error: err.message,
      };
    }
  }

  private async applyOperation(
    type: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    // Simulate different processing times for different operations
    const times: Record<string, number> = {
      resize: 300,
      crop: 200,
      compress: 400,
      watermark: 250,
      convert: 350,
    };

    await this.sleep(times[type] || 200);
    this.logger.log(`  → ${type} completed with params:`, params);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
