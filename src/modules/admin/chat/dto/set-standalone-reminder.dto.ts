import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SetStandaloneReminderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  note: string;

  @IsDateString()
  remindAt: string;
}
