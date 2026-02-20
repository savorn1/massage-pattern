import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskComment, TaskCommentSchema, TaskSchema, User, UserSchema } from '@/modules/shared/entities';
import { TaskCommentsService } from './task-comments.service';
import { TaskCommentsController } from './task-comments.controller';
import { UploadsModule } from '@/modules/uploads/uploads.module';
import { TaskDomainEventsModule } from '@/modules/admin/task-domain-events/task-domain-events.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaskComment.name, schema: TaskCommentSchema },
      { name: Task.name, schema: TaskSchema },
      { name: User.name, schema: UserSchema }
    ]),
    UploadsModule,
    TaskDomainEventsModule,
  ],
  controllers: [TaskCommentsController],
  providers: [TaskCommentsService],
  exports: [TaskCommentsService],
})
export class TaskCommentsModule {}
