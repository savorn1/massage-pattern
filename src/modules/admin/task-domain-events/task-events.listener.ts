import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NatsPubSubService } from '@/modules/messaging/nats-pubsub/nats-pubsub.service';
import { TaskActivitiesService } from '@/modules/admin/task-activities/task-activities.service';
import { TaskActivityAction } from '@/modules/shared/entities';
import {
  TASK_EVENTS,
  TaskCommentAddedEvent,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskFileAttachedEvent,
} from './task-events.service';

@Injectable()
export class TaskEventsListener implements OnModuleInit {
  private readonly logger = new Logger(TaskEventsListener.name);

  constructor(
    private readonly nats: NatsPubSubService,
    private readonly activitiesService: TaskActivitiesService,
  ) {}

  onModuleInit() {
    this.subscribeAll();
    this.logger.log('Task event listeners registered');
  }

  private subscribeAll() {
    // ── task.comment.added ──────────────────────────────────────────────────
    this.nats.subscribe(TASK_EVENTS.COMMENT_ADDED, async (raw) => {
      try {
        const event: TaskCommentAddedEvent = JSON.parse(raw);
        await this.activitiesService.logActivity(
          event.taskId,
          event.userId,
          TaskActivityAction.COMMENT_ADDED,
          { commentId: event.commentId, hasAttachment: event.hasAttachment },
        );
        this.logger.debug(`[task.comment.added] activity logged for task ${event.taskId}`);
      } catch (err) {
        this.logger.error(`[task.comment.added] handler failed: ${err}`);
      }
    });

    // ── task.created ────────────────────────────────────────────────────────
    this.nats.subscribe(TASK_EVENTS.CREATED, async (raw) => {
      try {
        const event: TaskCreatedEvent = JSON.parse(raw);
        await this.activitiesService.logActivity(
          event.taskId,
          event.userId,
          TaskActivityAction.CREATED,
          { title: event.title },
        );
        this.logger.debug(`[task.created] activity logged for task ${event.taskId}`);
      } catch (err) {
        this.logger.error(`[task.created] handler failed: ${err}`);
      }
    });

    // ── task.updated ────────────────────────────────────────────────────────
    this.nats.subscribe(TASK_EVENTS.UPDATED, async (raw) => {
      try {
        const event: TaskUpdatedEvent = JSON.parse(raw);
        // Log one activity per changed field
        for (const change of event.changes) {
          const action = this.changeToAction(change);
          if (action) {
            await this.activitiesService.logActivity(
              event.taskId,
              event.userId,
              action,
              { field: change },
            );
          }
        }
        this.logger.debug(`[task.updated] activities logged for task ${event.taskId}`);
      } catch (err) {
        this.logger.error(`[task.updated] handler failed: ${err}`);
      }
    });

    // ── task.file.attached ──────────────────────────────────────────────────
    this.nats.subscribe(TASK_EVENTS.FILE_ATTACHED, async (raw) => {
      try {
        const event: TaskFileAttachedEvent = JSON.parse(raw);
        await this.activitiesService.logActivity(
          event.taskId,
          event.userId,
          TaskActivityAction.FILE_ATTACHED,
          { fileId: event.fileId, fileName: event.fileName },
        );
        this.logger.debug(`[task.file.attached] activity logged for task ${event.taskId}`);
      } catch (err) {
        this.logger.error(`[task.file.attached] handler failed: ${err}`);
      }
    });
  }

  private changeToAction(field: string): TaskActivityAction | null {
    const map: Record<string, TaskActivityAction> = {
      status:      TaskActivityAction.STATUS_CHANGED,
      priority:    TaskActivityAction.PRIORITY_CHANGED,
      assigneeId:  TaskActivityAction.ASSIGNED,
      dueDate:     TaskActivityAction.DUE_DATE_CHANGED,
      sprintId:    TaskActivityAction.SPRINT_CHANGED,
      title:       TaskActivityAction.TITLE_CHANGED,
      description: TaskActivityAction.DESCRIPTION_CHANGED,
    };
    return map[field] ?? null;
  }
}
