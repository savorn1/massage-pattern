import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ConversationType } from '@/modules/shared/entities';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsArray()
  @IsMongoId({ each: true })
  participants: string[];

  // Required for group conversations
  @ValidateIf((o) => o.type === ConversationType.GROUP)
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
