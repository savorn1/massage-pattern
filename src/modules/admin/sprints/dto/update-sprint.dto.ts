import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsEnum, MaxLength } from 'class-validator';
import { SprintStatus } from '@/modules/shared/entities';

export class UpdateSprintDto {
  @ApiPropertyOptional({ description: 'Sprint name', example: 'Sprint 1' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Sprint start date', example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Sprint end date', example: '2024-01-29' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Sprint status', enum: SprintStatus })
  @IsEnum(SprintStatus)
  @IsOptional()
  status?: SprintStatus;

  @ApiPropertyOptional({ description: 'Sprint goal', example: 'Complete user authentication' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  goal?: string;
}
