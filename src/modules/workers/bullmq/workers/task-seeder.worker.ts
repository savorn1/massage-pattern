import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job, Queue, Worker } from 'bullmq';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  Project,
  ProjectDocument,
  ProjectMember,
  ProjectMemberDocument,
  User,
  UserDocument,
  NotificationType,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '@/modules/shared/entities';
import { TasksService } from '@/modules/admin/tasks/tasks.service';
import { NotificationsService } from '@/modules/admin/notifications/notifications.service';
import { WebsocketGateway } from '@/modules/messaging/websocket/websocket.gateway';

const QUEUE_NAME = 'task-seeder';
const JOB_NAME = 'seed-task';

const FAKE_TITLES = [
  'Implement user authentication flow',
  'Fix responsive layout on mobile',
  'Add dark mode support',
  'Optimize slow database queries',
  'Write unit tests for core module',
  'Refactor payment service',
  'Add pagination to list views',
  'Fix memory leak in background worker',
  'Update API documentation',
  'Implement email verification',
  'Improve error handling',
  'Add export to CSV feature',
  'Review and merge open PRs',
  'Set up staging environment',
  'Investigate performance regression',
];

const FAKE_DESCRIPTIONS = [
  'Auto-generated task for testing real-time updates.',
  'This task was created by the scheduled task seeder.',
  'Scheduled seed task — verify live notification delivery.',
];

const PRIORITIES = Object.values(TaskPriority);
const TYPES = [TaskType.TASK, TaskType.BUG, TaskType.STORY];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

@Injectable()
export class TaskSeederWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskSeederWorker.name);
  private connection: Redis;
  private queue: Queue;
  private worker: Worker;

  constructor(
    private readonly tasksService: TasksService,
    private readonly notificationsService: NotificationsService,
    private readonly ws: WebsocketGateway,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ProjectMember.name) private readonly projectMemberModel: Model<ProjectMemberDocument>,
  ) {}

  async onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    this.connection.on('error', (err) =>
      this.logger.error('TaskSeeder Redis error:', err.message),
    );

    // Queue for scheduling the repeating job
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });

    // Remove stale repeatable jobs from previous runs to prevent duplicates
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Schedule one repeating job — fires every minute via cron
    await this.queue.add(JOB_NAME, {}, {
      repeat: { pattern: '* * * * *' },
      removeOnComplete: true,
      removeOnFail: 5,
    });

    // Worker that consumes jobs from the queue
    this.worker = new Worker(QUEUE_NAME, async (job) => this.processJob(job), {
      connection: this.connection,
    });

    this.worker.on('completed', (job: Job) =>
      this.logger.log(`✓ Seed job ${job.id} completed`),
    );

    this.worker.on('failed', (job: Job | undefined, err: Error) =>
      this.logger.error(`✗ Seed job ${job?.id} failed: ${err.message}`),
    );

    this.logger.log('TaskSeeder worker started — 1 fake task per minute');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
    this.logger.log('TaskSeeder worker stopped');
  }

  // ─── Job handler ────────────────────────────────────────────────────────────

  private async processJob(job: Job): Promise<void> {
    this.logger.log(`Running seed job ${job.id}`);

    // 1. Pick a random active project
    const projects = await this.projectModel.find({ status: 'active' }).lean();
    if (!projects.length) {
      this.logger.warn('No active projects — skipping seed');
      return;
    }
    const project = pick(projects);

    // 2. Pick random reporter + assignee from any user
    const users = await this.userModel.find({}).lean();
    if (!users.length) {
      this.logger.warn('No users found — skipping seed');
      return;
    }
    const reporter = pick(users);
    const assignee = pick(users);

    // 3. Create the fake task (TasksService handles key gen, cache bust, WS event)
    const task = await this.tasksService.createTask(
      {
        title: `[Auto] ${pick(FAKE_TITLES)}`,
        description: pick(FAKE_DESCRIPTIONS),
        type: pick(TYPES),
        status: TaskStatus.TODO,
        priority: pick(PRIORITIES),
        assigneeId: assignee._id.toString(),
        storyPoints: Math.floor(Math.random() * 8) + 1,
      },
      reporter._id.toString(),
      project._id.toString(),
    );

    this.logger.log(
      `Created "${task.key}" in project "${project.name}"`,
    );

    // 4. Notify every member of that project in real-time
    const members = await this.projectMemberModel
      .find({ projectId: project._id })
      .lean();

    for (const member of members) {
      const recipientId = member.userId.toString();

      const taskId = task._id as unknown as string; // Mongoose ObjectId to string
      const notification = await this.notificationsService.create({
        recipientId,
        actorId: reporter._id.toString(),
        taskId: taskId,
        taskTitle: task.title,
        type: NotificationType.ASSIGNED,
        message: `New task in ${project.name}: "${task.title}"`,
      });

      // Push directly to the user's personal socket room
      this.ws.broadcastToRoom(
        `user:${recipientId}`,
        'notification:new',
        notification.toObject(),
      );
    }

    this.logger.log(`Notified ${members.length} members`);
  }
}
