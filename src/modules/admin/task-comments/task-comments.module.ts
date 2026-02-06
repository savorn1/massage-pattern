import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskComment, TaskCommentSchema } from '@/modules/shared/entities';
import { TaskCommentsService } from './task-comments.service';
import { TaskCommentsController } from './task-comments.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TaskComment.name, schema: TaskCommentSchema }]),
  ],
  controllers: [TaskCommentsController],
  providers: [TaskCommentsService],
  exports: [TaskCommentsService],
})
export class TaskCommentsModule {}
