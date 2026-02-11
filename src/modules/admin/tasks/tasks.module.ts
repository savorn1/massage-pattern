import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskEventsService } from './task-events.service';
import { Task, TaskSchema, Project, ProjectSchema } from '@/modules/shared/entities';
import { TaskActivitiesModule } from '../task-activities/task-activities.module';
import { MessagingModule } from '@/modules/messaging/messaging.module';

/**
 * Tasks module for task management
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    forwardRef(() => TaskActivitiesModule),
    MessagingModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskEventsService],
  exports: [TasksService],
})
export class TasksModule {}
