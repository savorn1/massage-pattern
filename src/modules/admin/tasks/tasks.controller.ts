import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/constants/roles.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TaskStatus } from '@/modules/shared/entities';

@ApiTags('admin/tasks')
@ApiBearerAuth('JWT-auth')
@Controller('admin/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiQuery({ name: 'projectId', required: true, description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createTaskDto: CreateTaskDto,
    @Query('projectId') projectId: string,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const task = await this.tasksService.createTask(
      createTaskDto,
      currentUser.userId,
      projectId,
    );
    return {
      success: true,
      data: task,
      message: 'Task created successfully',
    };
  }

  @Get('project/:projectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tasks by project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getByProject(
    @Param('projectId') projectId: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.tasksService.getTasksByProject(
      projectId,
      skipNum,
      limitNum,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  @Get('my-tasks')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tasks assigned to current user' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'User tasks retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyTasks(
    @CurrentUser() currentUser: { userId: string },
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.tasksService.getTasksByAssignee(
      currentUser.userId,
      skipNum,
      limitNum,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  @Get('sprint/:sprintId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tasks by sprint' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBySprint(
    @Param('sprintId') sprintId: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 100;

    const result = await this.tasksService.getTasksBySprint(
      sprintId,
      skipNum,
      limitNum,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  @Get('backlog/:projectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get backlog tasks (tasks without sprint)' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'Backlog tasks retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBacklog(
    @Param('projectId') projectId: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    const result = await this.tasksService.getBacklogTasks(
      projectId,
      skipNum,
      limitNum,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string) {
    const task = await this.tasksService.findById(id);
    if (!task) {
      return {
        success: false,
        message: 'Task not found',
      };
    }

    return {
      success: true,
      data: task,
    };
  }

  @Get(':id/subtasks')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get subtasks of a task' })
  @ApiParam({ name: 'id', description: 'Parent task ID' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Subtasks retrieved successfully' })
  async getSubtasks(
    @Param('id') id: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    const result = await this.tasksService.getSubtasks(id, skipNum, limitNum);

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    const task = await this.tasksService.updateTask(id, updateTaskDto);

    return {
      success: true,
      data: task,
      message: 'Task updated successfully',
    };
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update task status' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done'] } } } })
  @ApiResponse({ status: 200, description: 'Task status updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: TaskStatus,
  ) {
    const task = await this.tasksService.updateStatus(id, status);
    return {
      success: true,
      data: task,
      message: 'Task status updated successfully',
    };
  }

  @Patch(':id/assign/:assigneeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign task to user' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiParam({ name: 'assigneeId', description: 'Assignee user ID' })
  @ApiResponse({ status: 200, description: 'Task assigned successfully' })
  @ApiResponse({ status: 404, description: 'Task or user not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async assignTask(
    @Param('id') id: string,
    @Param('assigneeId') assigneeId: string,
  ) {
    const task = await this.tasksService.assignTask(id, assigneeId);
    return {
      success: true,
      data: task,
      message: 'Task assigned successfully',
    };
  }

  @Patch(':id/unassign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Unassign task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task unassigned successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async unassignTask(@Param('id') id: string) {
    const task = await this.tasksService.unassignTask(id);
    return {
      success: true,
      data: task,
      message: 'Task unassigned successfully',
    };
  }

  @Patch(':id/sprint/:sprintId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Move task to sprint' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID (use "backlog" to remove from sprint)' })
  @ApiResponse({ status: 200, description: 'Task moved successfully' })
  @ApiResponse({ status: 404, description: 'Task or sprint not found' })
  async moveToSprint(
    @Param('id') id: string,
    @Param('sprintId') sprintId: string,
  ) {
    const task = await this.tasksService.moveToSprint(
      id,
      sprintId === 'backlog' ? null : sprintId,
    );
    return {
      success: true,
      data: task,
      message: 'Task moved successfully',
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id') id: string) {
    await this.tasksService.deleteTask(id);
    return {
      success: true,
      message: 'Task deleted successfully',
    };
  }
}
