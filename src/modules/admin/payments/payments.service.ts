import { BusinessException } from '@/core/exceptions/business.exception';
import { Order, OrderDocument, OrderStatus } from '@/modules/shared/entities';
import {
  PaymentQr,
  PaymentQrDocument,
  PaymentQrStatus,
} from '@/modules/shared/entities/payment-qr.entity';
import { PAYMENT_QUEUE, type PaymentJobData, type QrExpiredJobData } from '@/modules/workers/bullmq/workers/payment.worker';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { createHmac, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

/** Redis key helpers */
const QR_KEY = (qrId: string) => `payment:qr:${qrId}`;
const USED_KEY = (nonce: string) => `payment:used:${nonce}`;

/** QR expires in 2 minutes (seconds) */
const QR_TTL_SECONDS = 2 * 60;

interface QrPayload {
  qrId: string;
  orderId: string;
  clientId: string;
  amount: number;
  currency: string;
  nonce: string;
  expiresAt: number; // Unix timestamp (ms)
  issuedAt: number;
}

/** Sample order items for demo purposes */
const SAMPLE_ITEMS = [
  { productId: 'sample-product-001', name: 'MacBook Pro 14-inch M3 Pro', price: 1999.00, quantity: 1 },
  { productId: 'sample-product-002', name: 'AirPods Pro (2nd Gen)', price: 249.00, quantity: 1 },
];

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private redis: Redis;
  private paymentQueue: Queue;
  private readonly hmacSecret: string;

  constructor(
    @InjectModel(PaymentQr.name)
    private readonly qrModel: Model<PaymentQrDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly config: ConfigService,
  ) {
    this.hmacSecret =
      this.config.get<string>('PAYMENT_HMAC_SECRET') || 'change-me-in-production';
  }

  onModuleInit() {
    this.redis = new Redis({
      host: this.config.get<string>('REDIS_HOST') || 'localhost',
      port: this.config.get<number>('REDIS_PORT') || 6379,
      maxRetriesPerRequest: null,
    });
    this.redis.on('error', (err) =>
      this.logger.error('PaymentsService Redis error:', err.message),
    );
    this.paymentQueue = new Queue(PAYMENT_QUEUE, { connection: this.redis });
    this.logger.log('PaymentsService Redis + Queue ready');
  }

  async onModuleDestroy() {
    await this.paymentQueue?.close();
    await this.redis?.quit();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sample Order + QR (demo endpoint)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a demo order with sample items and immediately generate a QR code.
   * Useful for testing the full payment flow without manual setup.
   */
  async createSampleOrder(userId: string): Promise<{
    order: OrderDocument;
    qrId: string;
    qrImage: string;
    expiresAt: Date;
    amount: number;
    currency: string;
  }> {
    const totalAmount = SAMPLE_ITEMS.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0,
    );
    const currency = 'USD';

    // Create the order
    const order = await this.orderModel.create({
      clientId: userId,
      vendorId: userId, // self-vendor for demo
      items: SAMPLE_ITEMS,
      totalAmount,
      status: OrderStatus.PENDING,
      shippingAddress: '123 Main Street, San Francisco, CA 94102, USA',
      paymentMethod: 'qr_code',
      notes: 'Sample demo order',
      metadata: { currency },
      createdBy: userId,
    }) as OrderDocument;

    this.logger.log(`Sample order created: ${String(order._id)}`);

    // Generate QR for the newly created order
    const qrResult = await this.generateQr(
      { orderId: String(order._id), currency },
      userId,
    );

    return {
      order,
      ...qrResult,
      currency,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // QR Generation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a signed, time-limited payment QR code for an order.
   * Returns a base64 PNG data-URL ready to display to the payer.
   */
  async generateQr(
    dto: GenerateQrDto,
    clientId: string,
  ): Promise<{ qrId: string; qrImage: string; expiresAt: Date; amount: number }> {
    // 1. Load and validate the order
    const order = await this.orderModel.findById(dto.orderId).exec();
    if (!order) {
      throw BusinessException.resourceNotFound('Order', dto.orderId);
    }
    if (order.clientId !== clientId) {
      throw BusinessException.invalidOperation(
        'You do not have permission to pay this order',
      );
    }
    if (order.status !== OrderStatus.PENDING) {
      throw BusinessException.invalidOperation(
        `Order cannot be paid — current status: ${order.status}`,
      );
    }

    // 2. Build signed payload
    const qrId = randomUUID();
    const nonce = randomUUID();
    const issuedAt = Date.now();
    const expiresAt = issuedAt + QR_TTL_SECONDS * 1000;

    const payload: QrPayload = {
      qrId,
      orderId: dto.orderId,
      clientId,
      amount: order.totalAmount,
      currency: dto.currency ?? 'USD',
      nonce,
      expiresAt,
      issuedAt,
    };

    const signature = this.sign(payload);

    // 3. Persist to MongoDB (audit trail)
    await this.qrModel.create({
      qrId,
      orderId: dto.orderId,
      clientId,
      amount: order.totalAmount,
      currency: payload.currency,
      nonce,
      signature,
      expiresAt: new Date(expiresAt),
      status: PaymentQrStatus.PENDING,
      createdBy: clientId,
    });

    // 4. Cache in Redis for fast lookup (TTL = QR lifetime)
    await this.redis.setex(
      QR_KEY(qrId),
      QR_TTL_SECONDS,
      JSON.stringify({ ...payload, signature }),
    );

    // 5. Schedule proactive expiry — fires after TTL, marks DB record EXPIRED
    //    and pushes payment:expired WebSocket event to the user
    const expiryJobData: QrExpiredJobData = { qrId, orderId: dto.orderId, clientId };
    await this.paymentQueue.add('expire-qr', expiryJobData, {
      delay: QR_TTL_SECONDS * 1000,
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 5,
    });

    // 6. Encode signed payload → QR image (base64 PNG)
    const qrContent = JSON.stringify({ ...payload, signature });
    const qrImage = await QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
    });

    this.logger.log(`QR generated — qrId=${qrId} orderId=${dto.orderId} expiresAt=${new Date(expiresAt).toISOString()}`);

    return {
      qrId,
      qrImage,
      expiresAt: new Date(expiresAt),
      amount: order.totalAmount,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Payment Verification
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Called by the payment gateway after the payer submits payment.
   * Runs all security checks and marks the QR + order as PAID.
   * Returns the updated order for the gateway to confirm receipt.
   */
  async verifyAndProcess(dto: VerifyPaymentDto): Promise<{
    success: boolean;
    orderId: string;
    paidAt: Date;
  }> {
    // ── 1. Idempotency: reject duplicate nonce ──────────────────────────────
    const alreadyUsed = await this.redis.exists(USED_KEY(dto.nonce));
    if (alreadyUsed) {
      throw BusinessException.invalidOperation(
        'Payment already processed (duplicate nonce)',
      );
    }

    // ── 2. Load from Redis (fast path) ─────────────────────────────────────
    const cached = await this.redis.get(QR_KEY(dto.qrId));
    if (!cached) {
      // Not in Redis → either expired or never existed; fall through to DB check
      const dbRecord = await this.qrModel.findOne({ qrId: dto.qrId }).exec();
      if (!dbRecord) {
        throw BusinessException.resourceNotFound('PaymentQR', dto.qrId);
      }
      if (dbRecord.status !== PaymentQrStatus.PENDING) {
        throw BusinessException.invalidOperation(
          `QR is no longer valid — status: ${dbRecord.status}`,
        );
      }
      // Expired (not in Redis but still PENDING in DB)
      await this.qrModel.updateOne(
        { qrId: dto.qrId },
        { status: PaymentQrStatus.EXPIRED },
      );
      throw BusinessException.invalidOperation('QR code has expired');
    }

    const stored = JSON.parse(cached) as QrPayload & { signature: string };

    // ── 3. Verify signature ─────────────────────────────────────────────────
    const { signature: storedSig, ...payloadFields } = stored;
    const expectedSig = this.sign(payloadFields);
    if (expectedSig !== dto.signature || storedSig !== dto.signature) {
      this.logger.warn(`Invalid signature for qrId=${dto.qrId}`);
      throw BusinessException.invalidOperation('Invalid payment signature');
    }

    // ── 4. Check expiration ─────────────────────────────────────────────────
    if (Date.now() > stored.expiresAt) {
      await this.expireQr(dto.qrId);
      throw BusinessException.invalidOperation('QR code has expired');
    }

    // ── 5. Validate amount ──────────────────────────────────────────────────
    if (Math.abs(dto.amount - stored.amount) > 0.001) {
      this.logger.warn(
        `Amount mismatch for qrId=${dto.qrId}: expected=${stored.amount} got=${dto.amount}`,
      );
      throw BusinessException.invalidOperation(
        `Payment amount mismatch: expected ${stored.amount}, received ${dto.amount}`,
      );
    }

    // ── 6. Check order is still payable ────────────────────────────────────
    const order = await this.orderModel.findById(stored.orderId).exec();
    if (!order) {
      throw BusinessException.resourceNotFound('Order', stored.orderId);
    }
    if (order.status !== OrderStatus.PENDING) {
      throw BusinessException.invalidOperation(
        `Order is not payable — current status: ${order.status}`,
      );
    }

    // ── 7. Mark nonce as used (prevents replay attacks) ────────────────────
    await this.redis.setex(USED_KEY(dto.nonce), QR_TTL_SECONDS, '1');

    // ── 8. Persist PAID status ──────────────────────────────────────────────
    const paidAt = new Date();
    await this.qrModel.updateOne(
      { qrId: dto.qrId },
      { status: PaymentQrStatus.PAID, paidAt },
    );
    await this.redis.del(QR_KEY(dto.qrId));

    // ── 9. Update order status → CONFIRMED ─────────────────────────────────
    await this.orderModel.updateOne(
      { _id: stored.orderId },
      { status: OrderStatus.CONFIRMED, paymentMethod: 'qr_code' },
    );

    // ── 10. Enqueue async post-payment job (WebSocket notification, etc.) ──
    const jobData: PaymentJobData = {
      qrId: dto.qrId,
      orderId: stored.orderId,
      clientId: stored.clientId,
      amount: stored.amount,
      currency: stored.currency,
      paidAt: paidAt.toISOString(),
    };
    await this.paymentQueue.add('finalize-payment', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 10,
    });

    this.logger.log(`Payment confirmed — qrId=${dto.qrId} orderId=${stored.orderId}`);

    return { success: true, orderId: stored.orderId, paidAt };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Status check
  // ─────────────────────────────────────────────────────────────────────────────

  async getQrStatus(qrId: string, clientId: string) {
    const record = await this.qrModel.findOne({ qrId, clientId }).exec();
    if (!record) {
      throw BusinessException.resourceNotFound('PaymentQR', qrId);
    }

    // Sync expired QRs that are still PENDING in DB
    if (
      record.status === PaymentQrStatus.PENDING &&
      record.expiresAt < new Date()
    ) {
      await this.qrModel.updateOne({ qrId }, { status: PaymentQrStatus.EXPIRED });
      record.status = PaymentQrStatus.EXPIRED;
    }

    return {
      qrId: record.qrId,
      orderId: record.orderId,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      expiresAt: record.expiresAt,
      paidAt: record.paidAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private sign(payload: QrPayload): string {
    const canonical = JSON.stringify(
      Object.fromEntries(
        Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)),
      ),
    );
    return createHmac('sha256', this.hmacSecret).update(canonical).digest('hex');
  }

  private async expireQr(qrId: string) {
    await this.qrModel.updateOne({ qrId }, { status: PaymentQrStatus.EXPIRED });
    await this.redis.del(QR_KEY(qrId));
  }
}
