import { Injectable, Logger } from '@nestjs/common';
import { NatsPubSubService } from '@/modules/messaging/nats-pubsub/nats-pubsub.service';

// ─── Event Payloads ────────────────────────────────────────────────────────

export interface TaskCommentAddedEvent {
  taskId: string;
  taskTitle: string;
  userId: string;
  actorName: string;
  commentId: string;
  hasAttachment: boolean;
  content: string;
  mentionedUserIds: string[];
}

export interface TaskCreatedEvent {
  taskId: string;
  userId: string;
  title: string;
}

export interface TaskUpdatedEvent {
  taskId: string;
  taskTitle: string;
  userId: string;
  actorName: string;
  changes: string[];
  newAssigneeId?: string;
}

export interface TaskFileAttachedEvent {
  taskId: string;
  userId: string;
  fileId: string;
  fileName: string;
}

// ─── Subject names ─────────────────────────────────────────────────────────

export const TASK_EVENTS = {
  COMMENT_ADDED:  'task.comment.added',
  CREATED:        'task.created',
  UPDATED:        'task.updated',
  FILE_ATTACHED:  'task.file.attached',
} as const;

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class TaskEventsService {
  private readonly logger = new Logger(TaskEventsService.name);

  constructor(private readonly nats: NatsPubSubService) {}

  publishCommentAdded(payload: TaskCommentAddedEvent): void {
    this.publish(TASK_EVENTS.COMMENT_ADDED, payload);
  }

  publishTaskCreated(payload: TaskCreatedEvent): void {
    this.publish(TASK_EVENTS.CREATED, payload);
  }

  publishTaskUpdated(payload: TaskUpdatedEvent): void {
    this.publish(TASK_EVENTS.UPDATED, payload);
  }

  publishFileAttached(payload: TaskFileAttachedEvent): void {
    this.publish(TASK_EVENTS.FILE_ATTACHED, payload);
  }

  private publish(subject: string, payload: object): void {
    try {
      this.nats.publish(subject, JSON.stringify(payload));
      this.logger.debug(`Event published → ${subject}`);
    } catch (err) {
      // NATS is best-effort — never block the main flow if it's down
      this.logger.warn(`Failed to publish event ${subject}: ${err}`);
    }
  }
}
