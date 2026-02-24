import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDate,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FundPoolType } from '@/modules/shared/entities';

export class UpdateFundPoolDto {
  @ApiPropertyOptional({ description: 'Fund pool type', enum: FundPoolType })
  @IsEnum(FundPoolType)
  @IsOptional()
  type?: FundPoolType;

  @ApiPropertyOptional({ description: 'Fund pool name', example: 'Emergency Reserve' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Amount added to the pool on each interval execution', example: 500 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  recurringAmount?: number;

  @ApiPropertyOptional({ description: 'Interval in minutes for scheduled execution', example: 60 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  intervalMinutes?: number;

  @ApiPropertyOptional({ description: 'Whether the pool is enabled', example: true })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Last execution timestamp' })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  lastExecutedAt?: Date;
}
