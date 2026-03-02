import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { MessageType } from '@/modules/shared/entities';

export class SendMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsMongoId()
  replyTo?: string;
}
