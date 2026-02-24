import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
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

export class CreateFundPoolDto {
  @ApiProperty({ description: 'Fund pool type', enum: FundPoolType })
  @IsEnum(FundPoolType)
  type: FundPoolType;

  @ApiProperty({ description: 'Fund pool name', example: 'Emergency Reserve' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Amount added to the pool on each interval execution', example: 500 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  recurringAmount?: number;

  @ApiProperty({ description: 'Interval in minutes for scheduled execution', example: 60 })
  @IsNumber()
  @Min(1)
  intervalMinutes: number;

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
