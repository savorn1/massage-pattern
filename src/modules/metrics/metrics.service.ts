import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  collectDefaultMetrics,
  register,
} from 'prom-client';
import { Worker } from 'bullmq';

@Injectable()
export class MetricsService {
  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationMs: Histogram<string>;
  readonly bullmqJobsTotal: Counter<string>;
  readonly bullmqJobDurationMs: Histogram<string>;
  readonly bullmqQueueSize: Gauge<string>;

  constructor() {
    collectDefaultMetrics();

    this.httpRequestsTotal = this.getOrCreate(
      'http_requests_total',
      () =>
        new Counter({
          name: 'http_requests_total',
          help: 'Total number of HTTP requests',
          labelNames: ['method', 'route', 'status_code'],
        }),
    ) as Counter<string>;

    this.httpRequestDurationMs = this.getOrCreate(
      'http_request_duration_ms',
      () =>
        new Histogram({
          name: 'http_request_duration_ms',
          help: 'HTTP request duration in milliseconds',
          labelNames: ['method', 'route'],
          buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
        }),
    ) as Histogram<string>;

    this.bullmqJobsTotal = this.getOrCreate(
      'bullmq_jobs_total',
      () =>
        new Counter({
          name: 'bullmq_jobs_total',
          help: 'Total BullMQ jobs by queue and status',
          labelNames: ['queue', 'status'],
        }),
    ) as Counter<string>;

    this.bullmqJobDurationMs = this.getOrCreate(
      'bullmq_job_duration_ms',
      () =>
        new Histogram({
          name: 'bullmq_job_duration_ms',
          help: 'BullMQ job processing duration in milliseconds',
          labelNames: ['queue'],
          buckets: [100, 500, 1000, 2000, 5000, 10000, 30000],
        }),
    ) as Histogram<string>;

    this.bullmqQueueSize = this.getOrCreate(
      'bullmq_queue_size',
      () =>
        new Gauge({
          name: 'bullmq_queue_size',
          help: 'Current BullMQ queue size by state',
          labelNames: ['queue', 'state'],
        }),
    ) as Gauge<string>;
  }

  /** Attach Prometheus event listeners to a BullMQ Worker instance. */
  trackWorkerMetrics(worker: Worker, queueName: string): void {
    worker.on('completed', (job) => {
      this.bullmqJobsTotal.inc({ queue: queueName, status: 'completed' });
      if (job.finishedOn && job.processedOn) {
        const duration = job.finishedOn - job.processedOn;
        this.bullmqJobDurationMs.observe({ queue: queueName }, duration);
      }
    });

    worker.on('failed', () => {
      this.bullmqJobsTotal.inc({ queue: queueName, status: 'failed' });
    });
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }

  private getOrCreate(name: string, factory: () => unknown): unknown {
    return register.getSingleMetric(name) ?? factory();
  }
}
