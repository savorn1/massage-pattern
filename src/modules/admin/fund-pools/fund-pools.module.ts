import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FundPool, FundPoolSchema } from '@/modules/shared/entities';
import { FundPoolsService } from './fund-pools.service';
import { FundPoolsController } from './fund-pools.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FundPool.name, schema: FundPoolSchema },
    ]),
  ],
  controllers: [FundPoolsController],
  providers: [FundPoolsService],
  exports: [FundPoolsService],
})
export class FundPoolsModule {}
