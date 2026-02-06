import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateTaskCommentDto {
  @ApiProperty({ description: 'Comment content', example: 'Updated comment' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
