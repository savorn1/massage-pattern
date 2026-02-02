import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  Matches,
} from 'class-validator';

/**
 * DTO for authenticating a private channel
 */
export class AuthPrivateChannelDto {
  @IsString()
  @IsNotEmpty()
  socket_id: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^private-/, { message: 'Channel must start with "private-"' })
  channel_name: string;
}

/**
 * DTO for authenticating a presence channel
 */
export class AuthPresenceChannelDto {
  @IsString()
  @IsNotEmpty()
  socket_id: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^presence-/, { message: 'Channel must start with "presence-"' })
  channel_name: string;

  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsObject()
  @IsOptional()
  user_info?: Record<string, unknown>;
}

/**
 * Generic channel auth DTO (handles both private and presence)
 */
export class AuthChannelDto {
  @IsString()
  @IsNotEmpty()
  socket_id: string;

  @IsString()
  @IsNotEmpty()
  channel_name: string;
}
