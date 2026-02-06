import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workplace, WorkplaceSchema } from '@/modules/shared/entities';
import { WorkplacesService } from './workplaces.service';
import { WorkplacesController } from './workplaces.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Workplace.name, schema: WorkplaceSchema }]),
  ],
  controllers: [WorkplacesController],
  providers: [WorkplacesService],
  exports: [WorkplacesService],
})
export class WorkplacesModule {}
