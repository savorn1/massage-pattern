import { Controller, Get, Post, Body } from '@nestjs/common';
import { UseCaseExamplesService } from './use-case-examples.service';

@Controller('examples')
export class UseCaseExamplesController {
  constructor(private readonly examples: UseCaseExamplesService) {}

  /**
   * Decision guide - when to use what
   * GET /examples/guide
   */
  @Get('guide')
  getDecisionGuide() {
    return this.examples.getDecisionGuide();
  }

  /**
   * Example: User Registration
   * POST /examples/user-registration
   */
  @Post('user-registration')
  async userRegistration(
    @Body()
    body: {
      userId?: string;
      email?: string;
      name?: string;
    },
  ) {
    return this.examples.userRegistration({
      userId: body.userId || `user-${Date.now()}`,
      email: body.email || 'user@example.com',
      name: body.name || 'John Doe',
    });
  }

  /**
   * Example: Order Processing
   * POST /examples/order
   */
  @Post('order')
  async processOrder(
    @Body()
    body: {
      orderId?: string;
      customerId?: string;
      items?: Array<{ productId: string; quantity: number; price: number }>;
      total?: number;
    },
  ) {
    return this.examples.processOrder({
      orderId: body.orderId || `ORD-${Date.now()}`,
      customerId: body.customerId || 'CUST-001',
      items: body.items || [
        { productId: 'PROD-1', quantity: 2, price: 29.99 },
        { productId: 'PROD-2', quantity: 1, price: 49.99 },
      ],
      total: body.total || 109.97,
    });
  }

  /**
   * Example: Chat Message
   * POST /examples/chat
   */
  @Post('chat')
  async sendChatMessage(
    @Body()
    body: {
      roomId?: string;
      senderId?: string;
      content?: string;
      type?: 'text' | 'image' | 'file';
    },
  ) {
    return this.examples.sendChatMessage({
      roomId: body.roomId || 'room-general',
      senderId: body.senderId || 'user-123',
      content: body.content || 'Hello, this is a test message!',
      type: body.type || 'text',
    });
  }

  /**
   * Example: Analytics Event
   * POST /examples/analytics
   */
  @Post('analytics')
  async trackEvent(
    @Body()
    body: {
      userId?: string;
      event?: string;
      properties?: Record<string, unknown>;
      sessionId?: string;
    },
  ) {
    return this.examples.trackEvent({
      userId: body.userId || 'user-123',
      event: body.event || 'page_view',
      properties: body.properties || { page: '/home', referrer: 'google' },
      sessionId: body.sessionId || `session-${Date.now()}`,
    });
  }

  /**
   * Example: File Upload
   * POST /examples/file-upload
   */
  @Post('file-upload')
  async processFileUpload(
    @Body()
    body: {
      fileId?: string;
      userId?: string;
      filename?: string;
      mimetype?: string;
      size?: number;
      path?: string;
    },
  ) {
    return this.examples.processFileUpload({
      fileId: body.fileId || `file-${Date.now()}`,
      userId: body.userId || 'user-123',
      filename: body.filename || 'photo.jpg',
      mimetype: body.mimetype || 'image/jpeg',
      size: body.size || 1024000,
      path: body.path || '/uploads/photo.jpg',
    });
  }

  /**
   * Example: Schedule Report
   * POST /examples/schedule-report
   */
  @Post('schedule-report')
  async scheduleReport(
    @Body()
    body: {
      reportId?: string;
      userId?: string;
      type?: 'daily' | 'weekly' | 'monthly';
      email?: string;
    },
  ) {
    return this.examples.scheduleReport({
      reportId: body.reportId || `report-${Date.now()}`,
      userId: body.userId || 'user-123',
      type: body.type || 'daily',
      email: body.email || 'user@example.com',
    });
  }

  /**
   * Example: Cache Invalidation
   * POST /examples/cache-invalidation
   */
  @Post('cache-invalidation')
  async invalidateCache(
    @Body()
    body: {
      key?: string;
      reason?: string;
    },
  ) {
    return this.examples.invalidateCache(
      body.key || 'user:*:profile',
      body.reason || 'User profile updated',
    );
  }
}
