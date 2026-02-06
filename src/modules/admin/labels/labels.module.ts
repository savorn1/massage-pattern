import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Label, LabelSchema } from '@/modules/shared/entities';
import { LabelsService } from './labels.service';
import { LabelsController } from './labels.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Label.name, schema: LabelSchema }]),
  ],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}
