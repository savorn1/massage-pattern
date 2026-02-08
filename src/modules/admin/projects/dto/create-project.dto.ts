import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';
import { ProjectPriority } from '@/modules/shared/entities';

export class CreateProjectDto {
  @ApiProperty({ description: 'Project name', example: 'Website Redesign' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Project key (unique identifier)',
    example: 'WEB',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Key must contain only uppercase letters and numbers',
  })
  key: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'Complete overhaul of the company website',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Project priority', enum: ProjectPriority })
  @IsEnum(ProjectPriority)
  @IsOptional()
  priority?: ProjectPriority;

  @ApiPropertyOptional({ description: 'Project start date', example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Project end date', example: '2024-06-30' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
