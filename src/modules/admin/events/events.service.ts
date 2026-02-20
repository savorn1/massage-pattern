import { Injectable, Logger } from '@nestjs/common';
import { RedisPubsubService } from '@/modules/messaging/redis-pubsub/redis-pubsub.service';
import { NatsPubSubService } from '@/modules/messaging/nats-pubsub/nats-pubsub.service';
import { WebsocketGateway } from '@/modules/messaging/websocket/websocket.gateway';

export enum EventType {
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_DELETED = 'task:deleted',
  TASK_REORDERED = 'task:reordered',
  PROJECT_CREATED = 'project:created',
  PROJECT_UPDATED = 'project:updated',
  PROJECT_DELETED = 'project:deleted',
  SPRINT_CREATED = 'sprint:created',
  SPRINT_UPDATED = 'sprint:updated',
  SPRINT_DELETED = 'sprint:deleted',
}

export interface TaskEvent {
  type: EventType;
  task: any;
  projectId: string;
  userId?: string;
  timestamp: string;
}

export interface ProjectEvent {
  type: EventType;
  project: any;
  workplaceId: string;
  userId?: string;
  timestamp: string;
}

/**
 * Events Service
 * Handles real-time event publishing via Redis Pub/Sub and WebSocket
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly redisPubsubService: RedisPubsubService,
    private readonly natsPubSubService: NatsPubSubService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  /**
   * Emit a task event
   */
  async emitTaskEvent(event: TaskEvent): Promise<void> {
    try {
      const payload = JSON.stringify(event);

      // Publish to Redis
      await this.redisPubsubService.publish('task:events', payload);

      // Broadcast via WebSocket to project room
      this.websocketGateway.server.to(`project:${event.projectId}`).emit(event.type, {
        ...event,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Task event emitted: ${event.type} for task ${event.task?._id || event.task?.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit task event: ${error.message}`, error.stack);
    }
  }

  /**
   * Emit a project event
   */
  async emitProjectEvent(event: ProjectEvent): Promise<void> {
    try {
      const payload = JSON.stringify(event);

      // Publish to Redis
      await this.redisPubsubService.publish('project:events', payload);

      // Broadcast via WebSocket to workplace room
      this.websocketGateway.server.to(`workplace:${event.workplaceId}`).emit(event.type, {
        ...event,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Project event emitted: ${event.type} for project ${event.project?._id || event.project?.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit project event: ${error.message}`, error.stack);
    }
  }

  /**
   * Emit a custom event to a specific room
   */
  async emitToRoom(room: string, eventType: string, data: any): Promise<void> {
    try {
      const payload = {
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
      };

      // Publish to Redis
      await this.redisPubsubService.publish(`room:${room}`, JSON.stringify(payload));

      // Broadcast via WebSocket
      this.websocketGateway.server.to(room).emit(eventType, payload);

      this.logger.log(`Event emitted to room ${room}: ${eventType}`);
    } catch (error) {
      this.logger.error(`Failed to emit event to room: ${error.message}`, error.stack);
    }
  }

  // --- NATS-based methods (for benchmarking vs Redis) ---

  async emitTaskEventViaNats(event: TaskEvent): Promise<void> {
    try {
      const payload = JSON.stringify(event);

      this.natsPubSubService.publish('task:events', payload);

      this.websocketGateway.server.to(`project:${event.projectId}`).emit(event.type, {
        ...event,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`[NATS] Task event emitted: ${event.type} for task ${event.task?._id || event.task?.id}`);
    } catch (error) {
      this.logger.error(`[NATS] Failed to emit task event: ${error.message}`, error.stack);
    }
  }

  async emitProjectEventViaNats(event: ProjectEvent): Promise<void> {
    try {
      const payload = JSON.stringify(event);

      this.natsPubSubService.publish('project:events', payload);

      this.websocketGateway.server.to(`workplace:${event.workplaceId}`).emit(event.type, {
        ...event,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`[NATS] Project event emitted: ${event.type} for project ${event.project?._id || event.project?.id}`);
    } catch (error) {
      this.logger.error(`[NATS] Failed to emit project event: ${error.message}`, error.stack);
    }
  }

  async emitToRoomViaNats(room: string, eventType: string, data: any): Promise<void> {
    try {
      const payload = {
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
      };

      this.natsPubSubService.publish(`room.${room}`, JSON.stringify(payload));

      this.websocketGateway.server.to(room).emit(eventType, payload);

      this.logger.log(`[NATS] Event emitted to room ${room}: ${eventType}`);
    } catch (error) {
      this.logger.error(`[NATS] Failed to emit event to room: ${error.message}`, error.stack);
    }
  }
}
