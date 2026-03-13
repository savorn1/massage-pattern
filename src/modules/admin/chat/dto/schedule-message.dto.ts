import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MessageType } from '@/modules/shared/entities';

export class ScheduleMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsDateString()
  scheduledFor: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsMongoId()
  replyTo?: string;
}
