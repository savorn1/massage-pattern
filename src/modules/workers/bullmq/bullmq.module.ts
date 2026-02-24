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
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullmqController } from './bullmq.controller';
import { BullmqService } from './bullmq.service';
import { EmailWorker } from './workers/email.worker';
import { ImageWorker } from './workers/image.worker';
import { FundPoolExecutorWorker } from './workers/fund-pool-executor.worker';
import { TaskSeederWorker } from './workers/task-seeder.worker';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: ProjectMember.name, schema: ProjectMemberSchema },
      { name: User.name, schema: UserSchema },
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
  ],
  exports: [BullmqService],
})
export class BullmqModule { }
