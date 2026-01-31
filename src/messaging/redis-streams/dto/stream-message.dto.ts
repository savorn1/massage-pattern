import { IsString, IsNotEmpty, IsObject, IsOptional, IsNumber, Min } from 'class-validator';

export class AddMessageDto {
  @IsString()
  @IsNotEmpty()
  stream: string;

  @IsObject()
  @IsNotEmpty()
  data: Record<string, string | number>;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxLen?: number;
}

export class ReadMessagesDto {
  @IsString()
  @IsNotEmpty()
  stream: string;

  @IsString()
  @IsOptional()
  startId?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  count?: number;
}

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  stream: string;

  @IsString()
  @IsNotEmpty()
  group: string;

  @IsString()
  @IsOptional()
  startId?: string;
}

export class ConsumeGroupDto {
  @IsString()
  @IsNotEmpty()
  stream: string;

  @IsString()
  @IsNotEmpty()
  group: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  count?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  blockMs?: number;
}

export class AcknowledgeDto {
  @IsString()
  @IsNotEmpty()
  stream: string;

  @IsString()
  @IsNotEmpty()
  group: string;

  @IsString()
  @IsNotEmpty()
  messageId: string;
}
