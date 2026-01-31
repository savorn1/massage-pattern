import { Module } from '@nestjs/common';

// Feature modules (enterprise structure)
import { AdminModule } from './admin/admin.module';
import { ClientModule } from './client/client.module';
import { VendorModule } from './vendor/vendor.module';

/**
 * Features Module
 *
 * Groups all business domain modules:
 * - Admin - User management, system administration
 * - Client - Customer-facing features, orders
 * - Vendor - Product management, inventory
 */
@Module({
  imports: [AdminModule, ClientModule, VendorModule],
  exports: [AdminModule, ClientModule, VendorModule],
})
export class FeaturesModule {}
