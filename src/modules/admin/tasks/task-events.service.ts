import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisPubsubService } from '@/modules/messaging/redis-pubsub/redis-pubsub.service';
import { WebsocketGateway } from '@/modules/messaging/websocket/websocket.gateway';

export enum TaskEventType {
  TASK_MOVED = 'task:moved',
  TASK_UPDATED = 'task:updated',
  TASK_CREATED = 'task:created',
  TASK_DELETED = 'task:deleted',
  TASK_REORDERED = 'task:reordered',
}

export interface TaskEventPayload {
  type: TaskEventType;
  projectId: string;
  taskId: string;
  data: Record<string, unknown>;
  userId: string;
  clientId?: string;
  timestamp: string;
}

@Injectable()
export class TaskEventsService implements OnModuleInit {
  private readonly logger = new Logger(TaskEventsService.name);

  constructor(
    private readonly redisPubsub: RedisPubsubService,
    private readonly wsGateway: WebsocketGateway,
  ) {}

  async onModuleInit() {
    await this.redisPubsub.subscribe('task-events', (message: string) => {
      try {
        const payload: TaskEventPayload = JSON.parse(message);
        const room = `project:${payload.projectId}`;
        this.wsGateway.server.to(room).emit(payload.type, payload);
        this.logger.log(`Broadcast ${payload.type} to room ${room}`);
      } catch (err) {
        this.logger.error('Failed to process task event from Redis', err);
      }
    });
    this.logger.log('Subscribed to task-events Redis channel');
  }

  async publishTaskEvent(payload: TaskEventPayload): Promise<void> {
    await this.redisPubsub.publish('task-events', JSON.stringify(payload));
  }
}
