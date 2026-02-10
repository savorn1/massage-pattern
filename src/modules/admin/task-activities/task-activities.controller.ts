import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TaskActivitiesService } from './task-activities.service';

@ApiTags('Task Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/tasks/:taskId/activities')
export class TaskActivitiesController {
  constructor(private readonly activitiesService: TaskActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all activities for a task' })
  @ApiResponse({ status: 200, description: 'List of activities' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('taskId') taskId: string,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activitiesService.getTaskActivities(taskId, skip, limit);
  }
}
