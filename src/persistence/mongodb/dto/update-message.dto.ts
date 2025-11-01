import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdateMessageDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  recipient?: string;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isRead?: boolean;
}
