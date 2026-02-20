import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NatsPubSubService } from '@/modules/messaging/nats-pubsub/nats-pubsub.service';
import { WebsocketGateway } from '@/modules/messaging/websocket/websocket.gateway';
import { NotificationsService } from '@/modules/admin/notifications/notifications.service';
import { NotificationType } from '@/modules/shared/entities';
import {
  TASK_EVENTS,
  TaskCommentAddedEvent,
  TaskUpdatedEvent,
  TaskFileAttachedEvent,
} from './task-events.service';

@Injectable()
export class TaskNotificationsListener implements OnModuleInit {
  private readonly logger = new Logger(TaskNotificationsListener.name);

  constructor(
    private readonly nats: NatsPubSubService,
    private readonly ws: WebsocketGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.subscribeAll();
    this.logger.log('Task notification listeners registered');
  }

  private subscribeAll() {
    // ── task.comment.added ──────────────────────────────────────────────────
    this.nats.subscribe(TASK_EVENTS.COMMENT_ADDED, async (raw) => {
      try {
        const event: TaskCommentAddedEvent = JSON.parse(raw);

        // 1. Broadcast real-time update to task room (live comment feed)
        this.ws.broadcastToRoom(`task:${event.taskId}`, 'task:comment.added', {
          taskId: event.taskId,
          userId: event.userId,
          commentId: event.commentId,
          hasAttachment: event.hasAttachment,
          timestamp: new Date().toISOString(),
        });

        // 2. Create mention notifications for each @mentioned user
        for (const recipientId of event.mentionedUserIds) {
          const created = await this.notificationsService.create({
            recipientId,
            actorId: event.userId,
            taskId: event.taskId,
            taskTitle: event.taskTitle,
            type: NotificationType.MENTIONED,
            message: `${event.actorName} mentioned you in "${event.taskTitle}"`,
          });
          this.ws.broadcastToRoom(`user:${recipientId}`, 'notification:new', created);
        }
      } catch (err) {
        this.logger.error(`[task.comment.added] handler failed: ${err}`);
      }
    });

    // ── task.updated ────────────────────────────────────────────────────────
    this.nats.subscribe(TASK_EVENTS.UPDATED, async (raw) => {
      try {
        const event: TaskUpdatedEvent = JSON.parse(raw);

        // Broadcast real-time task update to task room
        this.ws.broadcastToRoom(`task:${event.taskId}`, 'task:updated', {
          taskId: event.taskId,
          userId: event.userId,
          changes: event.changes,
          timestamp: new Date().toISOString(),
        });

        // Create assignment notification when a new assignee is set
        if (event.newAssigneeId && event.newAssigneeId !== event.userId) {
          const created = await this.notificationsService.create({
            recipientId: event.newAssigneeId,
            actorId: event.userId,
            taskId: event.taskId,
            taskTitle: event.taskTitle,
            type: NotificationType.ASSIGNED,
            message: `${event.actorName} assigned you to "${event.taskTitle}"`,
          });
          this.ws.broadcastToRoom(`user:${event.newAssigneeId}`, 'notification:new', created);
        }
      } catch (err) {
        this.logger.error(`[task.updated] handler failed: ${err}`);
      }
    });

    // ── task.file.attached ──────────────────────────────────────────────────
    this.nats.subscribe(TASK_EVENTS.FILE_ATTACHED, (raw) => {
      try {
        const event: TaskFileAttachedEvent = JSON.parse(raw);
        this.ws.broadcastToRoom(`task:${event.taskId}`, 'task:file.attached', {
          taskId: event.taskId,
          userId: event.userId,
          fileId: event.fileId,
          fileName: event.fileName,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        this.logger.error(`[task.file.attached] ws broadcast failed: ${err}`);
      }
    });
  }
}
