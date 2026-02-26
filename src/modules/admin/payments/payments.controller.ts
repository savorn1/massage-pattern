import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('admin/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /admin/payments/sample-order
   * Creates a demo order with sample items and immediately returns a QR code.
   * Useful for testing the full payment flow without manual setup.
   */
  @Post('sample-order')
  @UseGuards(JwtAuthGuard)
  async createSampleOrder(
    @CurrentUser() currentUser: { userId: string },
  ) {
    const result = await this.paymentsService.createSampleOrder(currentUser.userId);
    return {
      success: true,
      data: result,
      message: 'Sample order created with QR code — valid for 10 minutes',
    };
  }

  /**
   * POST /admin/payments/generate-qr
   * Authenticated user generates a signed QR for one of their orders.
   */
  @Post('generate-qr')
  @UseGuards(JwtAuthGuard)
  async generateQr(
    @Body() dto: GenerateQrDto,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const result = await this.paymentsService.generateQr(dto, currentUser.userId);
    return {
      success: true,
      data: result,
      message: 'QR code generated — valid for 10 minutes',
    };
  }

  /**
   * POST /admin/payments/verify
   * Called by the payment gateway after the payer submits payment.
   * No client auth required — gateway uses the embedded signed payload.
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    const result = await this.paymentsService.verifyAndProcess(dto);
    return {
      success: true,
      data: result,
      message: 'Payment verified and order confirmed',
    };
  }

  /**
   * GET /admin/payments/qr/:qrId/status
   * Authenticated user polls the status of their QR / payment.
   */
  @Get('qr/:qrId/status')
  @UseGuards(JwtAuthGuard)
  async getQrStatus(
    @Param('qrId') qrId: string,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const status = await this.paymentsService.getQrStatus(qrId, currentUser.userId);
    return { success: true, data: status };
  }
}
