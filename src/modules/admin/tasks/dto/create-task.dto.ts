import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { TaskStatus, TaskPriority, TaskType } from '@/modules/shared/entities';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title', example: 'Implement login page' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({
    description: 'Task description',
    example: 'Create the login page with email and password fields',
  })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ description: 'Task type', enum: TaskType, default: TaskType.TASK })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiPropertyOptional({ description: 'Task status', enum: TaskStatus, default: TaskStatus.TODO })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Task priority', enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Assignee user ID', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Sprint ID', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  sprintId?: string;

  @ApiPropertyOptional({ description: 'Label IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  labelIds?: string[];

  @ApiPropertyOptional({ description: 'Due date', example: '2024-02-15' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Story points', example: 5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  storyPoints?: number;

  @ApiPropertyOptional({ description: 'Parent task ID (for subtasks)', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  parentId?: string;
}
