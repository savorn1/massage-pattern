import { NotificationsModule } from '@/modules/admin/notifications/notifications.module';
import { TaskActivitiesModule } from '@/modules/admin/task-activities/task-activities.module';
import { NatsPubSubModule } from '@/modules/messaging/nats-pubsub/nats-pubsub.module';
import { WebsocketModule } from '@/modules/messaging/websocket/websocket.module';
import { Module } from '@nestjs/common';
import { TaskEventsListener } from './task-events.listener';
import { TaskEventsService } from './task-events.service';
import { TaskNotificationsListener } from './task-notifications.listener';

@Module({
  imports: [
    NatsPubSubModule,
    TaskActivitiesModule,
    WebsocketModule,
    NotificationsModule,
  ],
  providers: [TaskEventsService, TaskEventsListener, TaskNotificationsListener],
  exports: [TaskEventsService],
})
export class TaskEventsModule { }
