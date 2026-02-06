import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateTaskCommentDto {
  @ApiProperty({ description: 'Comment content', example: 'This looks good!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
