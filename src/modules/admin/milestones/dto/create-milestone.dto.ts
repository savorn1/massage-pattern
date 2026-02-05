import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MilestoneStatus } from '@/modules/shared/entities';

export class CreateMilestoneDto {
  @ApiProperty({ description: 'Milestone name', example: 'Phase 1 Complete', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Milestone description', example: 'Complete the initial phase of development', maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Project ID this milestone belongs to', example: 'proj-123' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ description: 'Milestone status', enum: MilestoneStatus, example: 'pending' })
  @IsEnum(MilestoneStatus)
  @IsOptional()
  status?: MilestoneStatus;

  @ApiProperty({ description: 'Milestone due date', example: '2024-03-31' })
  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
