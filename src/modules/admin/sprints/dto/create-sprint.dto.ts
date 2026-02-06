import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateSprintDto {
  @ApiProperty({ description: 'Sprint name', example: 'Sprint 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Sprint start date', example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Sprint end date', example: '2024-01-29' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Sprint goal', example: 'Complete user authentication' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  goal?: string;
}
