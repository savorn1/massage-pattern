import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { TaskSystemService } from './task-system.service';
import { CreateTaskDto, UpdateTaskDto, TaskStatus } from './task.dto';

@Controller('task-system')
export class TaskSystemController {
  constructor(private readonly taskSystemService: TaskSystemService) {}

  @Get()
  getInfo() {
    return {
      system: 'Task Management System',
      description:
        'Demonstrates RabbitMQ, Redis, and NATS working together in a real-world task management scenario',
      patterns: {
        'NATS RPC': ['User validation', 'Fetch user details', 'Audit logging'],
        RabbitMQ: ['Task notifications', 'Status change emails'],
        'Redis Pub/Sub': ['Real-time task events', 'System-wide notifications'],
      },
      endpoints: {
        'GET /task-system': 'This information',
        'POST /task-system/setup': 'Setup workers and subscribers',
        'POST /task-system/tasks': 'Create a new task',
        'GET /task-system/tasks': 'Get all tasks',
        'GET /task-system/tasks/:id': 'Get task by ID',
        'PUT /task-system/tasks/:id': 'Update task',
        'DELETE /task-system/tasks/:id': 'Delete task',
        'GET /task-system/tasks/user/:username': 'Get tasks by user',
        'GET /task-system/tasks/status/:status': 'Get tasks by status',
        'GET /task-system/statistics': 'Get system statistics',
      },
      testClient: '/task-system-client.html',
    };
  }

  @Post('setup')
  async setup() {
    await this.taskSystemService.startNotificationWorker();
    await this.taskSystemService.subscribeToTaskEvents();

    return {
      success: true,
      message: 'Task system workers and subscribers are running!',
      workers: ['task-notifications'],
      subscribers: ['task-events'],
    };
  }

  @Post('tasks')
  async createTask(@Body() createTaskDto: CreateTaskDto) {
    const task = await this.taskSystemService.createTask(createTaskDto);
    return {
      success: true,
      task,
      message: 'Task created successfully',
    };
  }

  @Get('tasks')
  getAllTasks() {
    const tasks = this.taskSystemService.getAllTasks();
    return {
      success: true,
      count: tasks.length,
      tasks,
    };
  }

  @Get('tasks/:id')
  async getTask(@Param('id') id: string) {
    const task = await this.taskSystemService.getTask(id);
    return {
      success: true,
      task,
    };
  }

  @Put('tasks/:id')
  async updateTask(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    const task = await this.taskSystemService.updateTask(id, updateTaskDto);
    return {
      success: true,
      task,
      message: 'Task updated successfully',
    };
  }

  @Delete('tasks/:id')
  async deleteTask(@Param('id') id: string) {
    await this.taskSystemService.deleteTask(id);
    return {
      success: true,
      message: 'Task deleted successfully',
    };
  }

  @Get('tasks/user/:username')
  getTasksByUser(@Param('username') username: string) {
    const tasks = this.taskSystemService.getTasksByUser(username);
    return {
      success: true,
      username,
      count: tasks.length,
      tasks,
    };
  }

  @Get('tasks/status/:status')
  getTasksByStatus(@Param('status') status: TaskStatus) {
    const tasks = this.taskSystemService.getTasksByStatus(status);
    return {
      success: true,
      status,
      count: tasks.length,
      tasks,
    };
  }

  @Get('statistics')
  getStatistics() {
    const stats = this.taskSystemService.getStatistics();
    return {
      success: true,
      statistics: stats,
    };
  }
}
