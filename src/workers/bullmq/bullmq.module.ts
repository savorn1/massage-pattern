import { Module } from '@nestjs/common';
import { BullmqService } from './bullmq.service';
import { BullmqController } from './bullmq.controller';
import { EmailWorker } from './workers/email.worker';
import { ImageWorker } from './workers/image.worker';

@Module({
  controllers: [BullmqController],
  providers: [BullmqService, EmailWorker, ImageWorker],
  exports: [BullmqService],
})
export class BullmqModule {}
