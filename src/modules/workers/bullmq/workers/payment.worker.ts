import { WebsocketGateway } from '@/modules/messaging/websocket/websocket.gateway';
import { OrderStatus } from '@/modules/shared/entities';
import {
  PaymentQr,
  PaymentQrDocument,
  PaymentQrStatus,
} from '@/modules/shared/entities/payment-qr.entity';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Model } from 'mongoose';

export const PAYMENT_QUEUE = 'payments';

export interface PaymentJobData {
  qrId: string;
  orderId: string;
  clientId: string;
  amount: number;
  currency: string;
  paidAt: string; // ISO string
}

export interface QrExpiredJobData {
  qrId: string;
  orderId: string;
  clientId: string;
}

/**
 * BullMQ worker for async post-payment processing.
 *
 * Handles two job types on the PAYMENT_QUEUE:
 *  • finalize-payment — broadcast payment:confirmed after a successful scan
 *  • expire-qr        — mark QR as EXPIRED in DB + broadcast payment:expired
 *
 * DB updates for successful payments happen synchronously inside PaymentsService
 * before the job is enqueued, so this worker stays side-effect only.
 * DB updates for QR expiry ARE done here (delayed job = TTL-accurate cleanup).
 */
@Injectable()
export class PaymentWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentWorker.name);
  private connection: Redis;
  private worker: Worker;

  constructor(
    private readonly ws: WebsocketGateway,
    @InjectModel(PaymentQr.name)
    private readonly qrModel: Model<PaymentQrDocument>,
  ) { }

  async onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    this.connection.on('error', (err) =>
      this.logger.error('PaymentWorker Redis error:', err.message),
    );

    this.worker = new Worker(PAYMENT_QUEUE, async (job: Job) => this.processJob(job),
      {
        connection: this.connection,
        concurrency: 10,
      },
    );

    this.worker.on('completed', (job: Job) => this.logger.log(`✓ Payment job ${job.id} (${job.name}) completed`),);

    this.worker.on('failed', (job: Job | undefined, err: Error) =>
      this.logger.error(`✗ Payment job ${job?.id} (${job?.name}) failed: ${err.message}`),
    );

    this.logger.log('PaymentWorker started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
    this.logger.log('PaymentWorker stopped');
  }

  // ─────────────────────────────────────────────────────────────────────────────

  private async processJob(job: Job): Promise<void> {
    switch (job.name) {
      case 'finalize-payment':
        return this.handlePaymentConfirmed(job.data as PaymentJobData);
      case 'expire-qr':
        return this.handleQrExpired(job.data as QrExpiredJobData);
      default:
        this.logger.warn(`Unknown payment job name: ${job.name}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // finalize-payment — broadcast confirmation after a successful QR scan
  // ─────────────────────────────────────────────────────────────────────────────

  private async handlePaymentConfirmed(data: PaymentJobData): Promise<void> {
    const { qrId, orderId, clientId, amount, currency, paidAt } = data;

    this.logger.log(`Finalizing payment — orderId=${orderId}`);

    const wsPayload = { orderId, qrId, amount, currency, paidAt, newStatus: OrderStatus.CONFIRMED };

    this.ws.broadcastToRoom(`user:${clientId}`, 'payment:confirmed', wsPayload);
    this.ws.broadcastToRoom(`order:${orderId}`, 'payment:confirmed', wsPayload);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // expire-qr — TTL-accurate DB cleanup + real-time notification
  // ─────────────────────────────────────────────────────────────────────────────

  private async handleQrExpired(data: QrExpiredJobData): Promise<void> {
    const { qrId, orderId, clientId } = data;

    // Only update if still PENDING — skip if already PAID or CANCELLED
    const result = await this.qrModel.updateOne(
      { qrId, status: PaymentQrStatus.PENDING },
      { status: PaymentQrStatus.EXPIRED },
    );

    if (result.modifiedCount === 0) {
      this.logger.log(`expire-qr skipped (already resolved) — qrId=${qrId}`);
      return;
    }

    this.logger.log(`QR expired — qrId=${qrId} orderId=${orderId}`);

    const wsPayload = { qrId, orderId };

    // Tell the payer their QR is no longer valid — UI switches to expired state
    this.ws.broadcastToRoom(`user:${clientId}`, 'payment:expired', wsPayload);

    // Notify the order room (vendor / admin view)
    this.ws.broadcastToRoom(`order:${orderId}`, 'payment:expired', wsPayload);
  }
}
