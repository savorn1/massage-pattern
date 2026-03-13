import { IsDateString, IsOptional, IsString } from 'class-validator';

export class SetReminderDto {
  @IsDateString()
  remindAt: string;

  @IsOptional()
  @IsString()
  note?: string;
}
