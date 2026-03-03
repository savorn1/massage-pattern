import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { MessageType } from '@/modules/shared/entities';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsMongoId()
  replyTo?: string;
}
