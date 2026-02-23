import { NatsPubSubService } from '@/modules/messaging/nats-pubsub/nats-pubsub.service';
import { RedisPubsubService } from '@/modules/messaging/redis-pubsub/redis-pubsub.service';
import { RedisStreamsService } from '@/modules/messaging/redis-streams/redis-streams.service';
import { WebsocketGateway } from '@/modules/messaging/websocket/websocket.gateway';
import { Injectable, Logger } from '@nestjs/common';

// Durable append-only event log — capped at 10 000 entries each
const TASK_EVENT_STREAM = 'stream:task-events';
const PROJECT_EVENT_STREAM = 'stream:project-events';
const STREAM_MAXLEN = 10_000;

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
    private readonly streamsService: RedisStreamsService,
  ) { }

  /**
   * Emit a task event
   *
   * Three things happen in parallel:
   *  1. Redis Pub/Sub  → fan-out to any other server instances subscribed
   *  2. WebSocket      → push directly to clients in the project room
   *  3. Redis Streams  → durable append-only log (MAXLEN ~10 000)
   */
  async emitTaskEvent(event: TaskEvent): Promise<void> {
    const taskId = event.task?._id?.toString() ?? event.task?.id ?? '';

    // WebSocket push always happens first — never blocked by Redis
    this.websocketGateway.server.to(`project:${event.projectId}`).emit(event.type, {
      ...event,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Task event emitted: ${event.type} for task ${taskId}`);

    // Redis operations are best-effort — failures are logged but never suppress WS delivery
    const payload = JSON.stringify(event);
    await Promise.all([
      this.redisPubsubService.publish('task:events', payload).catch((err: Error) =>
        this.logger.error(`[Task] Redis pub failed: ${err.message}`)
      ),
      this.streamsService.addMessage(
        TASK_EVENT_STREAM,
        { type: event.type, taskId, projectId: event.projectId, userId: event.userId ?? '', timestamp: event.timestamp },
        STREAM_MAXLEN,
      ).catch((err: Error) =>
        this.logger.error(`[Task] Redis stream failed: ${err.message}`)
      ),
    ]);
  }

  /**
   * Emit a project event
   *
   * Same three-way fan-out as emitTaskEvent.
   */
  async emitProjectEvent(event: ProjectEvent): Promise<void> {
    const projectId = event.project?._id?.toString() ?? event.project?.id ?? '';

    // WebSocket push always happens first — never blocked by Redis
    this.websocketGateway.server.to(`workplace:${event.workplaceId}`).emit(event.type, {
      ...event,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Project event emitted: ${event.type} for project ${projectId}`);

    // Redis operations are best-effort — failures are logged but never suppress WS delivery
    const payload = JSON.stringify(event);
    await Promise.all([
      this.redisPubsubService.publish('project:events', payload).catch((err: Error) =>
        this.logger.error(`[Project] Redis pub failed: ${err.message}`)
      ),
      this.streamsService.addMessage(
        PROJECT_EVENT_STREAM,
        { type: event.type, projectId, workplaceId: event.workplaceId, userId: event.userId ?? '', timestamp: event.timestamp },
        STREAM_MAXLEN,
      ).catch((err: Error) =>
        this.logger.error(`[Project] Redis stream failed: ${err.message}`)
      ),
    ]);
  }

  /**
   * Emit a custom event to a specific room
   */
  async emitToRoom(room: string, eventType: string, data: any): Promise<void> {
    const payload = {
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
    };

    // WebSocket push always happens first
    this.websocketGateway.server.to(room).emit(eventType, payload);

    this.logger.log(`Event emitted to room ${room}: ${eventType}`);

    // Redis pub/sub is best-effort
    await this.redisPubsubService.publish(`room:${room}`, JSON.stringify(payload)).catch((err: Error) =>
      this.logger.error(`[Room] Redis pub failed: ${err.message}`)
    );
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
