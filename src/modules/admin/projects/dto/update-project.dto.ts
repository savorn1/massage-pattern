import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsEnum, MaxLength } from 'class-validator';
import { ProjectStatus } from '@/modules/shared/entities';

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'Project name', example: 'Website Redesign' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'Complete overhaul of the company website',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Project status', enum: ProjectStatus })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: 'Project start date', example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Project end date', example: '2024-06-30' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
