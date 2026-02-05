import { Module } from '@nestjs/common';

// Feature modules (enterprise structure)
import { AdminModule } from './admin/admin.module';
import { ClientModule } from './client/client.module';
import { VendorModule } from './vendor/vendor.module';

@Module({
  imports: [AdminModule, ClientModule, VendorModule],
  exports: [AdminModule, ClientModule, VendorModule],
})
export class FeaturesModule {}
