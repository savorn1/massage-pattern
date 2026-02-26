import { FundPoolsModule } from '@/modules/admin/fund-pools/fund-pools.module';
import { NotificationsModule } from '@/modules/admin/notifications/notifications.module';
import { TasksModule } from '@/modules/admin/tasks/tasks.module';
import { MessagingModule } from '@/modules/messaging/messaging.module';
import { FeatureFlagModule } from '@/modules/feature-flags/feature-flag.module';
import {
  Project,
  ProjectMember,
  ProjectMemberSchema,
  ProjectSchema,
  User,
  UserSchema,
} from '@/modules/shared/entities';
import {
  PaymentQr,
  PaymentQrSchema,
} from '@/modules/shared/entities/payment-qr.entity';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullmqController } from './bullmq.controller';
import { BullmqService } from './bullmq.service';
import { EmailWorker } from './workers/email.worker';
import { ImageWorker } from './workers/image.worker';
import { FundPoolExecutorWorker } from './workers/fund-pool-executor.worker';
import { TaskSeederWorker } from './workers/task-seeder.worker';
import { PaymentWorker } from './workers/payment.worker';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: ProjectMember.name, schema: ProjectMemberSchema },
      { name: User.name, schema: UserSchema },
      { name: PaymentQr.name, schema: PaymentQrSchema },
    ]),
    TasksModule,
    NotificationsModule,
    MessagingModule,
    FundPoolsModule,
    FeatureFlagModule,
  ],
  controllers: [BullmqController],
  providers: [
    BullmqService,
    EmailWorker,
    ImageWorker,
    TaskSeederWorker,
    FundPoolExecutorWorker,
    PaymentWorker,
  ],
  exports: [BullmqService],
})
export class BullmqModule { }
