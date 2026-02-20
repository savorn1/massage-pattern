import { Module } from '@nestjs/common';
import { NatsPubSubModule } from '@/modules/messaging/nats-pubsub/nats-pubsub.module';
import { TaskActivitiesModule } from '@/modules/admin/task-activities/task-activities.module';
import { WebsocketModule } from '@/modules/messaging/websocket/websocket.module';
import { NotificationsModule } from '@/modules/admin/notifications/notifications.module';
import { TaskEventsService } from './task-events.service';
import { TaskEventsListener } from './task-events.listener';
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
export class TaskEventsModule {}
