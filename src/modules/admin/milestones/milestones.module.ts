import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';
import { Milestone, MilestoneSchema } from '@/modules/shared/entities';

/**
 * Milestones module for milestone management
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Milestone.name, schema: MilestoneSchema }]),
  ],
  controllers: [MilestonesController],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
