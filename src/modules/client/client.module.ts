import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';

/**
 * Client module - aggregates all client-related modules
 */
@Module({
  imports: [OrdersModule],
  exports: [OrdersModule],
})
export class ClientModule {}
