import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProjectMemberRole } from '@/modules/shared/entities';

export class UpdateProjectMemberRoleDto {
  @ApiProperty({
    description: 'New member role',
    enum: ProjectMemberRole,
  })
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;
}
