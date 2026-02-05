import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@/modules/shared/entities';

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'Task title', example: 'Implement user authentication', maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Task description', example: 'Add JWT authentication to the API', maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Milestone ID this task belongs to', example: 'milestone-456' })
  @IsString()
  @IsOptional()
  milestoneId?: string;

  @ApiPropertyOptional({ description: 'Task status', enum: TaskStatus, example: 'in_progress' })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Task priority', enum: TaskPriority, example: 'high' })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Assignee user ID', example: 'user-789' })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Task start date', example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Task due date', example: '2024-01-30' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Task completion date', example: '2024-01-28' })
  @IsDateString()
  @IsOptional()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Estimated hours to complete', example: 8, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedHours?: number;

  @ApiPropertyOptional({ description: 'Actual hours spent', example: 10, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  actualHours?: number;

  @ApiPropertyOptional({ description: 'Task dependency IDs', example: ['task-1', 'task-2'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dependencies?: string[];

  @ApiPropertyOptional({ description: 'Task tags', example: ['backend', 'auth'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  updatedBy?: string;
}
