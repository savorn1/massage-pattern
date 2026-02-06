import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ProjectMemberRole } from '@/modules/shared/entities';

export class AddProjectMemberDto {
  @ApiProperty({ description: 'User ID to add', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'Member role',
    enum: ProjectMemberRole,
    default: ProjectMemberRole.DEVELOPER,
  })
  @IsEnum(ProjectMemberRole)
  @IsOptional()
  role?: ProjectMemberRole;
}
