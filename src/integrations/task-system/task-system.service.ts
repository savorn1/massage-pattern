import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NatsRpcService } from '../../modules/messaging/nats-rpc/nats-rpc.service';
import { RabbitmqService } from '../../modules/messaging/rabbitmq/rabbitmq.service';
import { RedisPubsubService } from '../../modules/messaging/redis-pubsub/redis-pubsub.service';
import {
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskDto,
  UpdateTaskDto,
} from './task.dto';

@Injectable()
export class TaskSystemService {
  private readonly logger = new Logger(TaskSystemService.name);
  private tasks: Map<string, Task> = new Map();
  private taskIdCounter = 1;

  constructor(
    private readonly natsService: NatsRpcService,
    private readonly rabbitmqService: RabbitmqService,
    private readonly redisService: RedisPubsubService,
  ) {}

  /**
   * Create a new task
   * Uses all three messaging patterns:
   * 1. NATS RPC - Validate user exists
   * 2. RabbitMQ - Queue notification email
   * 3. Redis Pub/Sub - Broadcast task created event
   */
  async createTask(createTaskDto: CreateTaskDto): Promise<Task> {
    this.logger.log(`Creating task: ${createTaskDto.title}`);

    const taskId = `task-${this.taskIdCounter++}`;

    // Step 1: NATS RPC - Validate user via User Service
    this.logger.log(`[NATS RPC] Validating user: ${createTaskDto.assignedTo}`);
    try {
      const userValidation = await this.natsService.request(
        'user.validate',
        JSON.stringify({ username: createTaskDto.assignedTo }),
      );
      this.logger.log(`[NATS RPC] User validation response: ${userValidation}`);
    } catch {
      this.logger.warn(
        '[NATS RPC] User validation service not available (demo mode)',
      );
      // In demo mode, continue without validation
    }

    // Create the task
    const task: Task = {
      id: taskId,
      title: createTaskDto.title,
      description: createTaskDto.description,
      priority: createTaskDto.priority || TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      assignedTo: createTaskDto.assignedTo,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(taskId, task);
    this.logger.log(`✓ Task created: ${taskId}`);

    // Step 2: RabbitMQ - Queue notification email to user
    this.logger.log(`[RabbitMQ] Queuing task assignment notification...`);
    await this.rabbitmqService.sendToQueue(
      'task-notifications',
      JSON.stringify({
        type: 'task_assigned',
        taskId: task.id,
        title: task.title,
        assignedTo: task.assignedTo,
        priority: task.priority,
        timestamp: new Date(),
      }),
    );
    this.logger.log(`[RabbitMQ] ✓ Notification queued`);

    // Step 3: Redis Pub/Sub - Broadcast task created event
    this.logger.log(`[Redis Pub/Sub] Broadcasting task created event...`);
    const subscribers = await this.redisService.publish(
      'task-events',
      JSON.stringify({
        event: 'task_created',
        task,
        timestamp: new Date(),
      }),
    );
    this.logger.log(
      `[Redis Pub/Sub] ✓ Event broadcast to ${subscribers} subscriber(s)`,
    );

    return task;
  }

  /**
   * Update task status
   * Uses RabbitMQ and Redis
   */
  async updateTask(taskId: string, updateDto: UpdateTaskDto): Promise<Task> {
    this.logger.log(`Updating task: ${taskId}`);

    const task = this.tasks.get(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const oldStatus = task.status;

    // Update task
    if (updateDto.status) {
      task.status = updateDto.status;
      if (updateDto.status === TaskStatus.COMPLETED) {
        task.completedAt = new Date();
      }
    }
    task.updatedAt = new Date();

    this.tasks.set(taskId, task);
    this.logger.log(`✓ Task updated: ${taskId}`);

    // RabbitMQ - Queue notification if status changed
    if (updateDto.status && updateDto.status !== oldStatus) {
      this.logger.log(`[RabbitMQ] Queuing status change notification...`);
      await this.rabbitmqService.sendToQueue(
        'task-notifications',
        JSON.stringify({
          type: 'status_changed',
          taskId: task.id,
          title: task.title,
          oldStatus,
          newStatus: task.status,
          assignedTo: task.assignedTo,
          timestamp: new Date(),
        }),
      );
      this.logger.log(`[RabbitMQ] ✓ Status change notification queued`);
    }

    // Redis Pub/Sub - Broadcast task updated event
    this.logger.log(`[Redis Pub/Sub] Broadcasting task updated event...`);
    const subscribers = await this.redisService.publish(
      'task-events',
      JSON.stringify({
        event: 'task_updated',
        task,
        changes: updateDto,
        timestamp: new Date(),
      }),
    );
    this.logger.log(
      `[Redis Pub/Sub] ✓ Event broadcast to ${subscribers} subscriber(s)`,
    );

    return task;
  }

  /**
   * Delete task
   * Uses NATS RPC to log deletion and Redis to broadcast
   */
  async deleteTask(taskId: string): Promise<void> {
    this.logger.log(`Deleting task: ${taskId}`);

    const task = this.tasks.get(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // NATS RPC - Log to audit service
    this.logger.log(`[NATS RPC] Logging deletion to audit service...`);
    try {
      await this.natsService.request(
        'audit.log',
        JSON.stringify({
          action: 'task_deleted',
          taskId: task.id,
          title: task.title,
          deletedAt: new Date(),
        }),
      );
      this.logger.log(`[NATS RPC] ✓ Deletion logged to audit service`);
    } catch {
      this.logger.warn('[NATS RPC] Audit service not available (demo mode)');
    }

    // Delete task
    this.tasks.delete(taskId);
    this.logger.log(`✓ Task deleted: ${taskId}`);

    // Redis Pub/Sub - Broadcast task deleted event
    this.logger.log(`[Redis Pub/Sub] Broadcasting task deleted event...`);
    const subscribers = await this.redisService.publish(
      'task-events',
      JSON.stringify({
        event: 'task_deleted',
        taskId,
        timestamp: new Date(),
      }),
    );
    this.logger.log(
      `[Redis Pub/Sub] ✓ Event broadcast to ${subscribers} subscriber(s)`,
    );
  }

  /**
   * Get task by ID
   * Uses NATS RPC to fetch additional user details
   */
  async getTask(taskId: string): Promise<Task & { userDetails?: string }> {
    this.logger.log(`Fetching task: ${taskId}`);

    const task = this.tasks.get(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // NATS RPC - Fetch user details
    this.logger.log(`[NATS RPC] Fetching user details for: ${task.assignedTo}`);
    let userDetails: string | undefined;
    try {
      userDetails = await this.natsService.request(
        'user.details',
        JSON.stringify({ username: task.assignedTo }),
      );
      this.logger.log(`[NATS RPC] ✓ User details retrieved`);
    } catch {
      this.logger.warn('[NATS RPC] User service not available (demo mode)');
    }

    return {
      ...task,
      userDetails,
    };
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  /**
   * Get tasks by user
   */
  getTasksByUser(username: string): Task[] {
    return Array.from(this.tasks.values())
      .filter((task) => task.assignedTo === username)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values())
      .filter((task) => task.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Start background worker for task notifications
   */
  async startNotificationWorker(): Promise<void> {
    this.logger.log('[Worker] Starting task notification worker...');

    await this.rabbitmqService.consume('task-notifications', (message) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const notification = JSON.parse(message);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (notification.type === 'task_assigned') {
        this.logger.log(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `[Worker] 📧 Sending task assignment email to ${notification.assignedTo}`,
        );
        this.logger.log(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `[Worker]    Task: ${notification.title} (Priority: ${notification.priority})`,
        );
        setTimeout(() => {
          this.logger.log(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `[Worker] ✓ Email sent to ${notification.assignedTo}`,
          );
        }, 500);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      } else if (notification.type === 'status_changed') {
        this.logger.log(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `[Worker] 📧 Sending status update email to ${notification.assignedTo}`,
        );
        this.logger.log(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `[Worker]    ${notification.title}: ${notification.oldStatus} → ${notification.newStatus}`,
        );
        setTimeout(() => {
          this.logger.log(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `[Worker] ✓ Email sent to ${notification.assignedTo}`,
          );
        }, 500);
      }
    });

    this.logger.log('[Worker] ✓ Task notification worker started');
  }

  /**
   * Subscribe to task events
   */
  async subscribeToTaskEvents(): Promise<void> {
    this.logger.log('[Subscriber] Subscribing to task events...');

    await this.redisService.subscribe('task-events', (message) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const event = JSON.parse(message);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (event.event === 'task_created') {
        this.logger.log(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `[Subscriber] 🆕 New task created: ${event.task.title}`,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      } else if (event.event === 'task_updated') {
        this.logger.log(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `[Subscriber] 🔄 Task updated: ${event.task.title} (Status: ${event.task.status})`,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      } else if (event.event === 'task_deleted') {
        this.logger.log(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `[Subscriber] 🗑️  Task deleted: ${event.taskId}`,
        );
      }
    });

    this.logger.log('[Subscriber] ✓ Subscribed to task events');
  }

  /**
   * Get system statistics
   */
  getStatistics() {
    const allTasks = Array.from(this.tasks.values());

    return {
      total: allTasks.length,
      pending: allTasks.filter((t) => t.status === TaskStatus.PENDING).length,
      inProgress: allTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS)
        .length,
      completed: allTasks.filter((t) => t.status === TaskStatus.COMPLETED)
        .length,
      failed: allTasks.filter((t) => t.status === TaskStatus.FAILED).length,
      byPriority: {
        low: allTasks.filter((t) => t.priority === TaskPriority.LOW).length,
        medium: allTasks.filter((t) => t.priority === TaskPriority.MEDIUM)
          .length,
        high: allTasks.filter((t) => t.priority === TaskPriority.HIGH).length,
        urgent: allTasks.filter((t) => t.priority === TaskPriority.URGENT)
          .length,
      },
    };
  }
}
