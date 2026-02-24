import { NotificationsModule } from '@/modules/admin/notifications/notifications.module';
import { TasksModule } from '@/modules/admin/tasks/tasks.module';
import { MessagingModule } from '@/modules/messaging/messaging.module';
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
  ],
  controllers: [BullmqController],
  providers: [
    BullmqService,
    EmailWorker,
    ImageWorker,
    TaskSeederWorker
  ],
  exports: [BullmqService],
})
export class BullmqModule { }
