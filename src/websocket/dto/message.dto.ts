import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class MessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(10000, { message: 'Message is too long (max 10000 characters)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Room name is too long (max 100 characters)' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Room name can only contain letters, numbers, hyphens and underscores',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  room?: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Room name cannot be empty' })
  @MaxLength(100, { message: 'Room name is too long (max 100 characters)' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Room name can only contain letters, numbers, hyphens and underscores',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  room: string;
}

export class PrivateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Target ID cannot be empty' })
  @MaxLength(100, { message: 'Target ID is too long' })
  targetId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(10000, { message: 'Message is too long (max 10000 characters)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message: string;
}

export class AuthDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Token cannot be empty' })
  @MaxLength(500, { message: 'Token is too long' })
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Username cannot be empty' })
  @MaxLength(50, { message: 'Username is too long (max 50 characters)' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, hyphens and underscores',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username: string;
}
