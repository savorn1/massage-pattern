import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for triggering a single event
 */
export class TriggerEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  channel: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  event: string;

  @IsNotEmpty()
  data: unknown;

  @IsString()
  @IsOptional()
  socketId?: string;
}

/**
 * DTO for triggering an event on multiple channels
 */
export class TriggerMultipleDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100, { message: 'Maximum 100 channels allowed' })
  channels: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  event: string;

  @IsNotEmpty()
  data: unknown;
}

/**
 * Single event in batch
 */
export class BatchEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  channel: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsNotEmpty()
  data: unknown;
}

/**
 * DTO for batch triggering events
 */
export class TriggerBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchEventDto)
  @ArrayMaxSize(10, { message: 'Maximum 10 events per batch' })
  batch: BatchEventDto[];
}
