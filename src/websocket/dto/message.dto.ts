import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  room?: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  room: string;
}

export class AuthDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  username: string;
}
