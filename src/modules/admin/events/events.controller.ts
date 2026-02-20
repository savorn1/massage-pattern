import { Controller, Post, Body, Get } from '@nestjs/common';
import { EventsService, EventType } from './events.service';
import { LoadTestService, LoadTestConfig, SpikeTestConfig } from './load-test.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

class TestTaskEventDto {
  projectId: string;
  taskId?: string;
  title?: string;
}

class TestProjectEventDto {
  workplaceId: string;
  projectId?: string;
  name?: string;
}

@ApiTags('Events Testing')
@Controller('admin/events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly loadTestService: LoadTestService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check events service health' })
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'EventsService',
    };
  }

  @Post('test/task-created')
  @ApiOperation({ summary: 'Send test task:created event' })
  async testTaskCreated(@Body() dto: TestTaskEventDto) {
    const testTask = {
      _id: dto.taskId || `test-task-${Date.now()}`,
      title: dto.title || 'Test Task from API',
      description: 'This is a test task created via API',
      status: 'todo',
      priority: 'medium',
      projectId: dto.projectId,
      key: `TEST-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.eventsService.emitTaskEvent({
      type: EventType.TASK_CREATED,
      task: testTask,
      projectId: dto.projectId,
      userId: 'test-user',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Test task:created event sent',
      task: testTask,
    };
  }

  @Post('test/task-updated')
  @ApiOperation({ summary: 'Send test task:updated event' })
  async testTaskUpdated(@Body() dto: TestTaskEventDto) {
    const testTask = {
      _id: dto.taskId || `test-task-${Date.now()}`,
      title: dto.title || 'Updated Test Task',
      status: 'in_progress',
      priority: 'high',
      projectId: dto.projectId,
      updatedAt: new Date().toISOString(),
    };

    await this.eventsService.emitTaskEvent({
      type: EventType.TASK_UPDATED,
      task: testTask,
      projectId: dto.projectId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Test task:updated event sent',
      task: testTask,
    };
  }

  @Post('test/task-deleted')
  @ApiOperation({ summary: 'Send test task:deleted event' })
  async testTaskDeleted(@Body() dto: TestTaskEventDto) {
    const taskId = dto.taskId || `test-task-${Date.now()}`;

    await this.eventsService.emitTaskEvent({
      type: EventType.TASK_DELETED,
      task: { _id: taskId },
      projectId: dto.projectId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Test task:deleted event sent',
      taskId,
    };
  }

  @Post('test/project-created')
  @ApiOperation({ summary: 'Send test project:created event' })
  async testProjectCreated(@Body() dto: TestProjectEventDto) {
    const testProject = {
      _id: dto.projectId || `test-project-${Date.now()}`,
      name: dto.name || 'Test Project from API',
      description: 'This is a test project created via API',
      key: `TEST-${Date.now()}`,
      workplaceId: dto.workplaceId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.eventsService.emitProjectEvent({
      type: EventType.PROJECT_CREATED,
      project: testProject,
      workplaceId: dto.workplaceId,
      userId: 'test-user',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Test project:created event sent',
      project: testProject,
    };
  }

  @Post('test/project-updated')
  @ApiOperation({ summary: 'Send test project:updated event' })
  async testProjectUpdated(@Body() dto: TestProjectEventDto) {
    const testProject = {
      _id: dto.projectId || `test-project-${Date.now()}`,
      name: dto.name || 'Updated Test Project',
      workplaceId: dto.workplaceId,
      updatedAt: new Date().toISOString(),
    };

    await this.eventsService.emitProjectEvent({
      type: EventType.PROJECT_UPDATED,
      project: testProject,
      workplaceId: dto.workplaceId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Test project:updated event sent',
      project: testProject,
    };
  }

  @Post('test/custom')
  @ApiOperation({ summary: 'Send custom test event to a room' })
  async testCustomEvent(
    @Body() body: { room: string; eventType: string; data: any },
  ) {
    await this.eventsService.emitToRoom(
      body.room,
      body.eventType,
      body.data,
    );

    return {
      success: true,
      message: `Custom event sent to room: ${body.room}`,
      eventType: body.eventType,
    };
  }

  // --- NATS Test Endpoints ---

  @Post('test/nats/task-created')
  @ApiOperation({ summary: 'Send test task:created event via NATS' })
  async testNatsTaskCreated(@Body() dto: TestTaskEventDto) {
    const testTask = {
      _id: dto.taskId || `test-task-${Date.now()}`,
      title: dto.title || 'Test Task from NATS',
      description: 'This is a test task created via NATS',
      status: 'todo',
      priority: 'medium',
      projectId: dto.projectId,
      key: `NATS-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.eventsService.emitTaskEventViaNats({
      type: EventType.TASK_CREATED,
      task: testTask,
      projectId: dto.projectId,
      userId: 'test-user',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Test task:created event sent via NATS',
      task: testTask,
    };
  }

  @Post('test/nats/project-created')
  @ApiOperation({ summary: 'Send test project:created event via NATS' })
  async testNatsProjectCreated(@Body() dto: TestProjectEventDto) {
    const testProject = {
      _id: dto.projectId || `test-project-${Date.now()}`,
      name: dto.name || 'Test Project from NATS',
      description: 'This is a test project created via NATS',
      key: `NATS-${Date.now()}`,
      workplaceId: dto.workplaceId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.eventsService.emitProjectEventViaNats({
      type: EventType.PROJECT_CREATED,
      project: testProject,
      workplaceId: dto.workplaceId,
      userId: 'test-user',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Test project:created event sent via NATS',
      project: testProject,
    };
  }

  @Post('test/nats/custom')
  @ApiOperation({ summary: 'Send custom test event via NATS' })
  async testNatsCustomEvent(
    @Body() body: { room: string; eventType: string; data: any },
  ) {
    await this.eventsService.emitToRoomViaNats(
      body.room,
      body.eventType,
      body.data,
    );

    return {
      success: true,
      message: `Custom event sent via NATS to room: ${body.room}`,
      eventType: body.eventType,
    };
  }

  @Post('test/benchmark')
  @ApiOperation({ summary: 'Benchmark Redis vs NATS - send same event via both' })
  async benchmark(
    @Body() body: { room: string; eventType: string; data: any; iterations?: number },
  ) {
    const iterations = body.iterations || 1;
    const results = { redis: [] as number[], nats: [] as number[] };

    for (let i = 0; i < iterations; i++) {
      const payload = { ...body.data, iteration: i, benchmarkId: Date.now() };

      // Redis timing
      const redisStart = performance.now();
      await this.eventsService.emitToRoom(body.room, body.eventType, payload);
      results.redis.push(performance.now() - redisStart);

      // NATS timing
      const natsStart = performance.now();
      await this.eventsService.emitToRoomViaNats(body.room, body.eventType, payload);
      results.nats.push(performance.now() - natsStart);
    }

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    const min = (arr: number[]) => (arr.length > 0 ? Math.min(...arr) : 0);
    const max = (arr: number[]) => (arr.length > 0 ? Math.max(...arr) : 0);

    return {
      success: true,
      iterations,
      redis: {
        avgMs: Math.round(avg(results.redis) * 100) / 100,
        minMs: Math.round(min(results.redis) * 100) / 100,
        maxMs: Math.round(max(results.redis) * 100) / 100,
      },
      nats: {
        avgMs: Math.round(avg(results.nats) * 100) / 100,
        minMs: Math.round(min(results.nats) * 100) / 100,
        maxMs: Math.round(max(results.nats) * 100) / 100,
      },
      winner:
        avg(results.redis) < avg(results.nats) ? 'Redis' : 'NATS',
    };
  }

  // --- Load Test Endpoints ---

  @Post('load-test/start')
  @ApiOperation({ summary: 'Start a WebSocket load test with virtual clients' })
  async startLoadTest(@Body() config: LoadTestConfig) {
    return this.loadTestService.start({
      numClients: config.numClients || 10,
      room: config.room || 'load-test:default',
      messagesPerSecond: config.messagesPerSecond || 10,
      durationSeconds: config.durationSeconds || 30,
      serverUrl: config.serverUrl || 'http://localhost:3000',
    });
  }

  @Post('load-test/stop')
  @ApiOperation({ summary: 'Stop the running load test' })
  async stopLoadTest() {
    return this.loadTestService.stop();
  }

  @Get('load-test/stats')
  @ApiOperation({ summary: 'Get current load test statistics' })
  getLoadTestStats() {
    return this.loadTestService.getStats();
  }

  // --- Spike Test Endpoints ---

  @Post('spike-test/start')
  @ApiOperation({ summary: 'Start a spike test (base → spike → hold → drop → recovery)' })
  async startSpikeTest(@Body() config: SpikeTestConfig) {
    return this.loadTestService.startSpike({
      room: config.room || 'spike-test:default',
      messagesPerSecond: config.messagesPerSecond || 50,
      serverUrl: config.serverUrl || 'http://localhost:3000',
      baseClients: config.baseClients || 50,
      spikeClients: config.spikeClients || 500,
      baseSeconds: config.baseSeconds || 10,
      spikeSeconds: config.spikeSeconds || 15,
      recoverySeconds: config.recoverySeconds || 10,
      transport: config.transport,
    });
  }

  @Post('spike-test/stop')
  @ApiOperation({ summary: 'Stop the running spike test' })
  async stopSpikeTest() {
    return this.loadTestService.stop();
  }
}
