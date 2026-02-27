import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentGatewayGuard } from './guards/payment-gateway.guard';
import {
  PaymentQr,
  PaymentQrSchema,
} from '@/modules/shared/entities/payment-qr.entity';
import { Order, OrderSchema } from '@/modules/shared/entities';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentQr.name, schema: PaymentQrSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentGatewayGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
