import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module';

/**
 * Vendor module - aggregates all vendor-related modules
 */
@Module({
  imports: [ProductsModule],
  exports: [ProductsModule],
})
export class VendorModule {}
