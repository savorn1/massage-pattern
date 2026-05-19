import { IsNotEmpty, IsString } from 'class-validator';

export class RenameCvDto {
  @IsString()
  @IsNotEmpty()
  cvName: string;
}
