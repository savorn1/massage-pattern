import { MilestoneStatus } from '@/modules/shared/entities';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateMilestoneDto {
  @ApiPropertyOptional({ description: 'Milestone name', example: 'Phase 1 Complete', maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Milestone description', example: 'Complete the initial phase of development', maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Milestone status', enum: MilestoneStatus, example: 'in_progress' })
  @IsEnum(MilestoneStatus)
  @IsOptional()
  status?: MilestoneStatus;

  @ApiPropertyOptional({ description: 'Milestone due date', example: '2024-03-31' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Milestone completion date', example: '2024-03-28' })
  @IsDateString()
  @IsOptional()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Milestone progress percentage', example: 75, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;
}
