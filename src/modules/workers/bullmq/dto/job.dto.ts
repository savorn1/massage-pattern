import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
  Min,
  IsEmail,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// ════════════════════════════════════════════════════════════════════════════
// EMAIL JOB DTOs
// ════════════════════════════════════════════════════════════════════════════

export class SendEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsOptional()
  template?: string;
}

export class SendBulkEmailDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendEmailDto)
  emails: SendEmailDto[];
}

// ════════════════════════════════════════════════════════════════════════════
// IMAGE JOB DTOs
// ════════════════════════════════════════════════════════════════════════════

export enum ImageOperation {
  RESIZE = 'resize',
  CROP = 'crop',
  COMPRESS = 'compress',
  WATERMARK = 'watermark',
  CONVERT = 'convert',
}

export enum ImageFormat {
  JPG = 'jpg',
  PNG = 'png',
  WEBP = 'webp',
}

export class ImageOperationDto {
  @IsEnum(ImageOperation)
  type: ImageOperation;

  @IsObject()
  params: Record<string, unknown>;
}

export class ProcessImageDto {
  @IsString()
  @IsNotEmpty()
  imageId: string;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageOperationDto)
  operations: ImageOperationDto[];

  @IsEnum(ImageFormat)
  @IsOptional()
  outputFormat?: ImageFormat;
}

// ════════════════════════════════════════════════════════════════════════════
// GENERIC JOB DTOs
// ════════════════════════════════════════════════════════════════════════════

export class AddJobDto {
  @IsString()
  @IsNotEmpty()
  queue: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  @Min(0)
  delay?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  priority?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  attempts?: number;
}

export class AddScheduledJobDto {
  @IsString()
  @IsNotEmpty()
  queue: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  cron: string; // Cron pattern like "0 9 * * *"
}
