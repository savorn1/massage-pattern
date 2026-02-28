import { createHmac } from 'crypto';
import { BusinessException } from '@/core/exceptions/business.exception';
import { OrderStatus } from '@/modules/shared/entities';
import { PaymentQrStatus } from '@/modules/shared/entities/payment-qr.entity';
import { PaymentsService } from './payments.service';

// ── External module mocks ────────────────────────────────────────────────────

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockqr'),
}));

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Creates a chainable Mongoose query mock that resolves to `resolved`. */
function mockQuery(resolved: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {};
  for (const method of ['select', 'lean', 'sort', 'skip', 'limit']) {
    q[method] = jest.fn().mockReturnValue(q);
  }
  q.exec = jest.fn().mockResolvedValue(resolved);
  return q;
}

const TEST_SECRET = 'test-secret';

/**
 * Re-implements the private PaymentsService.sign() logic so tests can
 * produce correct signatures without accessing private members.
 */
function signPayload(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.fromEntries(
      Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
  return createHmac('sha256', TEST_SECRET).update(canonical).digest('hex');
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: PaymentsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQrModel: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockOrderModel: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRedis: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQueue: any;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'PAYMENT_HMAC_SECRET') return TEST_SECRET;
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        return null;
      }),
    };

    mockQrModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      // updateOne / updateMany are awaited directly (no .exec() call)
      updateOne: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
      countDocuments: jest.fn(),
    };

    mockOrderModel = {
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockResolvedValue({}),
    };

    service = new PaymentsService(
      mockQrModel,
      mockOrderModel,
      mockConfig as never,
    );

    // Bypass onModuleInit — inject mocked Redis and Queue directly
    service['redis'] = mockRedis;
    service['paymentQueue'] = mockQueue;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // generateQr()
  // ──────────────────────────────────────────────────────────────────────────

  describe('generateQr()', () => {
    const CLIENT_ID = 'user-abc';
    const ORDER_ID = 'order-xyz';

    const makePendingOrder = (overrides: Record<string, unknown> = {}) => ({
      _id: ORDER_ID,
      clientId: CLIENT_ID,
      totalAmount: 100,
      status: OrderStatus.PENDING,
      ...overrides,
    });

    it('throws 404 when order does not exist', async () => {
      mockOrderModel.findById.mockReturnValue(mockQuery(null));
      mockQrModel.find.mockReturnValue(mockQuery([]));

      const err = await service
        .generateQr({ orderId: ORDER_ID }, CLIENT_ID)
        .catch((e) => e);

      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getStatus()).toBe(404);
    });

    it('throws when order belongs to a different client', async () => {
      mockOrderModel.findById.mockReturnValue(
        mockQuery(makePendingOrder({ clientId: 'someone-else' })),
      );
      mockQrModel.find.mockReturnValue(mockQuery([]));

      await expect(
        service.generateQr({ orderId: ORDER_ID }, CLIENT_ID),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('throws when order status is not PENDING', async () => {
      mockOrderModel.findById.mockReturnValue(
        mockQuery(makePendingOrder({ status: OrderStatus.CONFIRMED })),
      );
      mockQrModel.find.mockReturnValue(mockQuery([]));

      await expect(
        service.generateQr({ orderId: ORDER_ID }, CLIENT_ID),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('cancels stale PENDING QRs before creating a new one', async () => {
      const staleId = 'old-qr-id';
      mockOrderModel.findById.mockReturnValue(mockQuery(makePendingOrder()));
      mockQrModel.find.mockReturnValue(mockQuery([{ qrId: staleId }]));

      await service.generateQr({ orderId: ORDER_ID }, CLIENT_ID);

      expect(mockRedis.del).toHaveBeenCalledWith(`payment:qr:${staleId}`);
      expect(mockQrModel.updateMany).toHaveBeenCalledWith(
        { qrId: { $in: [staleId] } },
        { status: PaymentQrStatus.CANCELLED },
      );
    });

    it('skips cancellation when no stale QRs exist', async () => {
      mockOrderModel.findById.mockReturnValue(mockQuery(makePendingOrder()));
      mockQrModel.find.mockReturnValue(mockQuery([]));

      await service.generateQr({ orderId: ORDER_ID }, CLIENT_ID);

      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(mockQrModel.updateMany).not.toHaveBeenCalled();
    });

    it('persists the QR record to MongoDB with PENDING status', async () => {
      mockOrderModel.findById.mockReturnValue(mockQuery(makePendingOrder()));
      mockQrModel.find.mockReturnValue(mockQuery([]));

      await service.generateQr({ orderId: ORDER_ID }, CLIENT_ID);

      expect(mockQrModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: ORDER_ID,
          clientId: CLIENT_ID,
          amount: 100,
          status: PaymentQrStatus.PENDING,
        }),
      );
    });

    it('stores signed payload in Redis with TTL', async () => {
      mockOrderModel.findById.mockReturnValue(mockQuery(makePendingOrder()));
      mockQrModel.find.mockReturnValue(mockQuery([]));

      await service.generateQr({ orderId: ORDER_ID }, CLIENT_ID);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^payment:qr:/),
        120, // QR_TTL_SECONDS
        expect.any(String),
      );
    });

    it('schedules an expire-qr BullMQ job', async () => {
      mockOrderModel.findById.mockReturnValue(mockQuery(makePendingOrder()));
      mockQrModel.find.mockReturnValue(mockQuery([]));

      await service.generateQr({ orderId: ORDER_ID }, CLIENT_ID);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'expire-qr',
        expect.objectContaining({ orderId: ORDER_ID, clientId: CLIENT_ID }),
        expect.objectContaining({ delay: 120_000 }),
      );
    });

    it('returns { qrId, qrImage, expiresAt, amount }', async () => {
      mockOrderModel.findById.mockReturnValue(mockQuery(makePendingOrder()));
      mockQrModel.find.mockReturnValue(mockQuery([]));

      const result = await service.generateQr({ orderId: ORDER_ID }, CLIENT_ID);

      expect(result).toMatchObject({
        qrId: expect.any(String),
        qrImage: 'data:image/png;base64,mockqr',
        expiresAt: expect.any(Date),
        amount: 100,
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // verifyAndProcess()
  // ──────────────────────────────────────────────────────────────────────────

  describe('verifyAndProcess()', () => {
    const QR_ID = 'qr-111';
    const NONCE = 'nonce-abc';
    const ORDER_ID = 'order-xyz';
    const CLIENT_ID = 'user-abc';
    const AMOUNT = 100;

    /** Builds a Redis-cached payload object whose signature is valid. */
    function buildValidStored(
      overrides: Partial<Record<string, unknown>> = {},
    ) {
      const payload = {
        qrId: QR_ID,
        orderId: ORDER_ID,
        clientId: CLIENT_ID,
        amount: AMOUNT,
        currency: 'USD',
        nonce: NONCE,
        expiresAt: Date.now() + 60_000,
        issuedAt: Date.now(),
        ...overrides,
      };
      const signature = signPayload(payload);
      return { ...payload, signature };
    }

    const makePendingOrder = (overrides: Record<string, unknown> = {}) => ({
      _id: ORDER_ID,
      clientId: CLIENT_ID,
      totalAmount: AMOUNT,
      status: OrderStatus.PENDING,
      ...overrides,
    });

    it('throws when nonce was already used (duplicate payment)', async () => {
      mockRedis.exists.mockResolvedValue(1);

      await expect(
        service.verifyAndProcess({
          qrId: QR_ID,
          nonce: NONCE,
          amount: AMOUNT,
          signature: 'x',
        }),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('throws 404 when QR not in Redis and not in DB', async () => {
      mockRedis.exists.mockResolvedValue(0);
      mockRedis.get.mockResolvedValue(null);
      mockQrModel.findOne.mockReturnValue(mockQuery(null));

      const err = await service
        .verifyAndProcess({ qrId: QR_ID, nonce: NONCE, amount: AMOUNT, signature: 'x' })
        .catch((e) => e);

      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getStatus()).toBe(404);
    });

    it('throws when QR is not in Redis and DB record is non-PENDING', async () => {
      mockRedis.exists.mockResolvedValue(0);
      mockRedis.get.mockResolvedValue(null);
      mockQrModel.findOne.mockReturnValue(
        mockQuery({ qrId: QR_ID, status: PaymentQrStatus.PAID }),
      );

      await expect(
        service.verifyAndProcess({ qrId: QR_ID, nonce: NONCE, amount: AMOUNT, signature: 'x' }),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('marks EXPIRED and throws "expired" when Redis key evicted but DB shows PENDING', async () => {
      mockRedis.exists.mockResolvedValue(0);
      mockRedis.get.mockResolvedValue(null);
      mockQrModel.findOne.mockReturnValue(
        mockQuery({ qrId: QR_ID, status: PaymentQrStatus.PENDING }),
      );

      const err = await service
        .verifyAndProcess({ qrId: QR_ID, nonce: NONCE, amount: AMOUNT, signature: 'x' })
        .catch((e) => e);

      expect(err).toBeInstanceOf(BusinessException);
      const res = err.getResponse() as Record<string, string>;
      expect(res.message).toMatch(/expired/i);
      expect(mockQrModel.updateOne).toHaveBeenCalledWith(
        { qrId: QR_ID },
        { status: PaymentQrStatus.EXPIRED },
      );
    });

    it('throws on bad signature', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const stored = buildValidStored();
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));

      await expect(
        service.verifyAndProcess({
          qrId: QR_ID,
          nonce: NONCE,
          amount: AMOUNT,
          signature: 'bad-signature',
        }),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('throws "expired" when timestamp is in the past', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const stored = buildValidStored({ expiresAt: Date.now() - 1000 });
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));

      const err = await service
        .verifyAndProcess({
          qrId: QR_ID,
          nonce: NONCE,
          amount: AMOUNT,
          signature: stored.signature as string,
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(BusinessException);
      const res = err.getResponse() as Record<string, string>;
      expect(res.message).toMatch(/expired/i);
    });

    it('throws on amount mismatch', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const stored = buildValidStored();
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));

      await expect(
        service.verifyAndProcess({
          qrId: QR_ID,
          nonce: NONCE,
          amount: AMOUNT + 50, // wrong amount
          signature: stored.signature as string,
        }),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('throws 404 when the order is not found', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const stored = buildValidStored();
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));
      mockOrderModel.findById.mockReturnValue(mockQuery(null));

      const err = await service
        .verifyAndProcess({
          qrId: QR_ID,
          nonce: NONCE,
          amount: AMOUNT,
          signature: stored.signature as string,
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getStatus()).toBe(404);
    });

    it('throws when order is no longer PENDING', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const stored = buildValidStored();
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));
      mockOrderModel.findById.mockReturnValue(
        mockQuery(makePendingOrder({ status: OrderStatus.CONFIRMED })),
      );

      await expect(
        service.verifyAndProcess({
          qrId: QR_ID,
          nonce: NONCE,
          amount: AMOUNT,
          signature: stored.signature as string,
        }),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('happy path: marks PAID, clears Redis, confirms order, enqueues job', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const stored = buildValidStored();
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));
      mockOrderModel.findById.mockReturnValue(mockQuery(makePendingOrder()));

      const result = await service.verifyAndProcess({
        qrId: QR_ID,
        nonce: NONCE,
        amount: AMOUNT,
        signature: stored.signature as string,
      });

      // Return value
      expect(result).toMatchObject({
        success: true,
        orderId: ORDER_ID,
        paidAt: expect.any(Date),
      });

      // Nonce marked used in Redis
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `payment:used:${NONCE}`,
        expect.any(Number),
        '1',
      );

      // QR Redis key deleted
      expect(mockRedis.del).toHaveBeenCalledWith(`payment:qr:${QR_ID}`);

      // QR record → PAID
      expect(mockQrModel.updateOne).toHaveBeenCalledWith(
        { qrId: QR_ID },
        expect.objectContaining({ status: PaymentQrStatus.PAID }),
      );

      // Order → CONFIRMED
      expect(mockOrderModel.updateOne).toHaveBeenCalledWith(
        { _id: ORDER_ID },
        expect.objectContaining({ status: OrderStatus.CONFIRMED }),
      );

      // Post-payment job enqueued
      expect(mockQueue.add).toHaveBeenCalledWith(
        'finalize-payment',
        expect.objectContaining({ qrId: QR_ID, orderId: ORDER_ID }),
        expect.any(Object),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getActiveQrForOrder()
  // ──────────────────────────────────────────────────────────────────────────

  describe('getActiveQrForOrder()', () => {
    const ORDER_ID = 'order-xyz';
    const CLIENT_ID = 'user-abc';

    it('returns null when no PENDING QR exists', async () => {
      mockQrModel.findOne.mockReturnValue(mockQuery(null));

      const result = await service.getActiveQrForOrder(ORDER_ID, CLIENT_ID);

      expect(result).toBeNull();
    });

    it('marks EXPIRED and returns null when QR is past expiresAt', async () => {
      const record = {
        qrId: 'qr-stale',
        orderId: ORDER_ID,
        clientId: CLIENT_ID,
        amount: 100,
        currency: 'USD',
        status: PaymentQrStatus.PENDING,
        expiresAt: new Date(Date.now() - 5_000),
        paidAt: null,
      };
      mockQrModel.findOne.mockReturnValue(mockQuery(record));

      const result = await service.getActiveQrForOrder(ORDER_ID, CLIENT_ID);

      expect(result).toBeNull();
      expect(mockQrModel.updateOne).toHaveBeenCalledWith(
        { qrId: 'qr-stale' },
        { status: PaymentQrStatus.EXPIRED },
      );
    });

    it('returns QR detail with qrImage when Redis cache is present', async () => {
      const record = {
        qrId: 'qr-valid',
        orderId: ORDER_ID,
        clientId: CLIENT_ID,
        amount: 250,
        currency: 'USD',
        status: PaymentQrStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
        paidAt: null,
      };
      mockQrModel.findOne.mockReturnValue(mockQuery(record));
      mockRedis.get.mockResolvedValue('{"mock":"cached-payload"}');

      const result = await service.getActiveQrForOrder(ORDER_ID, CLIENT_ID);

      expect(result).not.toBeNull();
      expect(result?.qrImage).toBe('data:image/png;base64,mockqr');
      expect(result?.secondsLeft).toBeGreaterThan(0);
      expect(result?.amount).toBe(250);
    });

    it('returns QR detail with qrImage=null when Redis key is missing', async () => {
      const record = {
        qrId: 'qr-no-cache',
        orderId: ORDER_ID,
        clientId: CLIENT_ID,
        amount: 250,
        currency: 'USD',
        status: PaymentQrStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
        paidAt: null,
      };
      mockQrModel.findOne.mockReturnValue(mockQuery(record));
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getActiveQrForOrder(ORDER_ID, CLIENT_ID);

      expect(result).not.toBeNull();
      expect(result?.qrImage).toBeNull();
      expect(result?.secondsLeft).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getQrById()
  // ──────────────────────────────────────────────────────────────────────────

  describe('getQrById()', () => {
    const QR_ID = 'qr-111';
    const CLIENT_ID = 'user-abc';

    it('throws 404 when QR record not found', async () => {
      mockQrModel.findOne.mockReturnValue(mockQuery(null));

      const err = await service.getQrById(QR_ID, CLIENT_ID).catch((e) => e);

      expect(err).toBeInstanceOf(BusinessException);
      expect(err.getStatus()).toBe(404);
    });

    it('lazily syncs PENDING → EXPIRED when expiresAt is in the past', async () => {
      const record = {
        qrId: QR_ID,
        orderId: 'order-xyz',
        amount: 100,
        currency: 'USD',
        status: PaymentQrStatus.PENDING,
        expiresAt: new Date(Date.now() - 5_000),
        paidAt: null,
      };
      mockQrModel.findOne.mockReturnValue(mockQuery(record));

      const result = await service.getQrById(QR_ID, CLIENT_ID);

      expect(result.status).toBe(PaymentQrStatus.EXPIRED);
      expect(result.qrImage).toBeNull();
      expect(result.secondsLeft).toBe(0);
      expect(mockQrModel.updateOne).toHaveBeenCalledWith(
        { qrId: QR_ID },
        { status: PaymentQrStatus.EXPIRED },
      );
    });

    it('returns qrImage for PENDING QR with Redis cache', async () => {
      const record = {
        qrId: QR_ID,
        orderId: 'order-xyz',
        amount: 100,
        currency: 'USD',
        status: PaymentQrStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
        paidAt: null,
      };
      mockQrModel.findOne.mockReturnValue(mockQuery(record));
      mockRedis.get.mockResolvedValue('{"mock":"payload"}');

      const result = await service.getQrById(QR_ID, CLIENT_ID);

      expect(result.qrImage).toBe('data:image/png;base64,mockqr');
      expect(result.secondsLeft).toBeGreaterThan(0);
    });

    it('returns qrImage=null and secondsLeft=0 for PAID QR', async () => {
      const record = {
        qrId: QR_ID,
        orderId: 'order-xyz',
        amount: 100,
        currency: 'USD',
        status: PaymentQrStatus.PAID,
        expiresAt: new Date(Date.now() - 60_000),
        paidAt: new Date(),
      };
      mockQrModel.findOne.mockReturnValue(mockQuery(record));

      const result = await service.getQrById(QR_ID, CLIENT_ID);

      expect(result.qrImage).toBeNull();
      expect(result.secondsLeft).toBe(0);
      expect(result.paidAt).toBeInstanceOf(Date);
    });
  });
});
