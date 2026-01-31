import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { BullmqService } from './bullmq.service';
import {
  SendEmailDto,
  SendBulkEmailDto,
  ProcessImageDto,
  AddJobDto,
  AddScheduledJobDto,
} from './dto/job.dto';

@Controller('bullmq')
export class BullmqController {
  constructor(private readonly bullmqService: BullmqService) {}

  // ════════════════════════════════════════════════════════════════════════════
  // EMAIL JOBS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Send an email (queued)
   * POST /bullmq/emails/send
   */
  @Post('emails/send')
  async sendEmail(@Body() dto: SendEmailDto) {
    const job = await this.bullmqService.addJobWithRetry(
      'emails',
      'send-email',
      dto,
      3,
    );
    return {
      success: true,
      jobId: job.id,
      queue: 'emails',
      message: 'Email job queued successfully',
    };
  }

  /**
   * Send bulk emails
   * POST /bullmq/emails/send-bulk
   */
  @Post('emails/send-bulk')
  async sendBulkEmails(@Body() dto: SendBulkEmailDto) {
    const jobs = await Promise.all(
      dto.emails.map((email) =>
        this.bullmqService.addJobWithRetry('emails', 'send-email', email, 3),
      ),
    );
    return {
      success: true,
      count: jobs.length,
      jobIds: jobs.map((j) => j.id),
      queue: 'emails',
    };
  }

  /**
   * Send a scheduled email
   * POST /bullmq/emails/schedule
   */
  @Post('emails/schedule')
  async scheduleEmail(
    @Body() dto: SendEmailDto,
    @Query('delay', new DefaultValuePipe(60000), ParseIntPipe) delay: number,
  ) {
    const job = await this.bullmqService.addDelayedJob(
      'emails',
      'send-email',
      dto,
      delay,
    );
    return {
      success: true,
      jobId: job.id,
      queue: 'emails',
      scheduledFor: new Date(Date.now() + delay).toISOString(),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // IMAGE JOBS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Process an image
   * POST /bullmq/images/process
   */
  @Post('images/process')
  async processImage(@Body() dto: ProcessImageDto) {
    const job = await this.bullmqService.addJob('images', 'process-image', dto);
    return {
      success: true,
      jobId: job.id,
      queue: 'images',
      imageId: dto.imageId,
      operations: dto.operations.length,
    };
  }

  /**
   * Process image with priority
   * POST /bullmq/images/process-priority
   */
  @Post('images/process-priority')
  async processImagePriority(
    @Body() dto: ProcessImageDto,
    @Query('priority', new DefaultValuePipe(1), ParseIntPipe) priority: number,
  ) {
    const job = await this.bullmqService.addPriorityJob(
      'images',
      'process-image',
      dto,
      priority,
    );
    return {
      success: true,
      jobId: job.id,
      queue: 'images',
      priority,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GENERIC JOB OPERATIONS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Add a generic job
   * POST /bullmq/jobs/add
   */
  @Post('jobs/add')
  async addJob(@Body() dto: AddJobDto) {
    const job = await this.bullmqService.addJob(dto.queue, dto.name, dto.data, {
      delay: dto.delay,
      priority: dto.priority,
      attempts: dto.attempts,
    });
    return {
      success: true,
      jobId: job.id,
      queue: dto.queue,
      name: dto.name,
    };
  }

  /**
   * Add a scheduled/repeating job
   * POST /bullmq/jobs/schedule
   */
  @Post('jobs/schedule')
  async addScheduledJob(@Body() dto: AddScheduledJobDto) {
    const job = await this.bullmqService.addRepeatingJob(
      dto.queue,
      dto.name,
      dto.data,
      dto.cron,
    );
    return {
      success: true,
      jobId: job.id,
      queue: dto.queue,
      cron: dto.cron,
    };
  }

  /**
   * Get job status
   * GET /bullmq/jobs/:queue/:jobId
   */
  @Get('jobs/:queue/:jobId')
  async getJobStatus(
    @Param('queue') queue: string,
    @Param('jobId') jobId: string,
  ) {
    const job = await this.bullmqService.getJob(queue, jobId);
    if (!job) {
      return { found: false, jobId, queue };
    }

    const state = await job.getState();

    return {
      found: true,
      jobId: job.id,
      name: job.name,
      queue,
      state,
      progress: job.progress as unknown,
      data: job.data as unknown,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    };
  }

  /**
   * Remove a job
   * DELETE /bullmq/jobs/:queue/:jobId
   */
  @Delete('jobs/:queue/:jobId')
  async removeJob(
    @Param('queue') queue: string,
    @Param('jobId') jobId: string,
  ) {
    const removed = await this.bullmqService.removeJob(queue, jobId);
    return { success: removed, jobId, queue };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // QUEUE OPERATIONS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get queue statistics
   * GET /bullmq/queues/:queue/stats
   */
  @Get('queues/:queue/stats')
  async getQueueStats(@Param('queue') queue: string) {
    return this.bullmqService.getQueueStats(queue);
  }

  /**
   * Get jobs in a queue by status
   * GET /bullmq/queues/:queue/jobs?status=waiting&limit=10
   */
  @Get('queues/:queue/jobs')
  async getQueueJobs(
    @Param('queue') queue: string,
    @Query('status', new DefaultValuePipe('waiting'))
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const jobs = await this.bullmqService.getJobs(queue, status, 0, limit - 1);
    return {
      queue,
      status,
      count: jobs.length,
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        data: j.data as unknown,
        attemptsMade: j.attemptsMade,
        timestamp: j.timestamp,
        failedReason: j.failedReason,
      })),
    };
  }

  /**
   * Get failed jobs
   * GET /bullmq/queues/:queue/failed
   */
  @Get('queues/:queue/failed')
  async getFailedJobs(
    @Param('queue') queue: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const jobs = await this.bullmqService.getFailedJobs(queue, limit);
    return {
      queue,
      count: jobs.length,
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        data: j.data as unknown,
        attemptsMade: j.attemptsMade,
        failedReason: j.failedReason,
        stacktrace: j.stacktrace,
      })),
    };
  }

  /**
   * Pause a queue
   * POST /bullmq/queues/:queue/pause
   */
  @Post('queues/:queue/pause')
  async pauseQueue(@Param('queue') queue: string) {
    await this.bullmqService.pauseQueue(queue);
    return { success: true, queue, action: 'paused' };
  }

  /**
   * Resume a queue
   * POST /bullmq/queues/:queue/resume
   */
  @Post('queues/:queue/resume')
  async resumeQueue(@Param('queue') queue: string) {
    await this.bullmqService.resumeQueue(queue);
    return { success: true, queue, action: 'resumed' };
  }

  /**
   * Retry all failed jobs in a queue
   * POST /bullmq/queues/:queue/retry-failed
   */
  @Post('queues/:queue/retry-failed')
  async retryFailedJobs(@Param('queue') queue: string) {
    const count = await this.bullmqService.retryFailedJobs(queue);
    return { success: true, queue, retriedCount: count };
  }

  /**
   * Drain a queue (remove waiting jobs)
   * DELETE /bullmq/queues/:queue/drain
   */
  @Delete('queues/:queue/drain')
  async drainQueue(@Param('queue') queue: string) {
    await this.bullmqService.drainQueue(queue);
    return { success: true, queue, action: 'drained' };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HEALTH & INFO
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Health check
   * GET /bullmq/health
   */
  @Get('health')
  healthCheck() {
    return {
      status: this.bullmqService.isConnected() ? 'connected' : 'disconnected',
      service: 'bullmq',
    };
  }

  /**
   * Get overview of all known queues
   * GET /bullmq/overview
   */
  @Get('overview')
  async getOverview() {
    const queues = ['emails', 'images']; // Known queues
    const stats = await Promise.all(
      queues.map((q) => this.bullmqService.getQueueStats(q)),
    );
    return {
      connected: this.bullmqService.isConnected(),
      queues: stats,
    };
  }
}
