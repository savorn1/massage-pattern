import { IsNotEmpty, IsString } from 'class-validator';

export class PublishDto {
  @IsString()
  @IsNotEmpty()
  channel: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

export class SubscribeDto {
  @IsString()
  @IsNotEmpty()
  channel: string;
}
