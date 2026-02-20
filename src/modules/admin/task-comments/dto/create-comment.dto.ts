import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateTaskCommentDto {
  @ApiPropertyOptional({ description: 'Comment content', example: 'This looks good!' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  content?: string;
}
