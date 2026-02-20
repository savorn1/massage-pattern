import { Module } from '@nestjs/common';

// Feature modules (enterprise structure)
import { AdminModule } from './admin/admin.module';
import { ClientModule } from './client/client.module';
import { VendorModule } from './vendor/vendor.module';
import { FeatureFlagModule } from './feature-flags/feature-flag.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [AdminModule, ClientModule, VendorModule, FeatureFlagModule, UploadsModule],
  exports: [AdminModule, ClientModule, VendorModule, FeatureFlagModule, UploadsModule],
})
export class FeaturesModule {}
