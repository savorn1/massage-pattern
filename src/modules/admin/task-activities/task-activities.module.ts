import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TaskActivity,
  TaskActivitySchema,
  Task,
  TaskSchema,
  User,
  UserSchema,
} from '@/modules/shared/entities';
import { TaskActivitiesService } from './task-activities.service';
import { TaskActivitiesController } from './task-activities.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaskActivity.name, schema: TaskActivitySchema },
      { name: Task.name, schema: TaskSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [TaskActivitiesController],
  providers: [TaskActivitiesService],
  exports: [TaskActivitiesService],
})
export class TaskActivitiesModule {}
