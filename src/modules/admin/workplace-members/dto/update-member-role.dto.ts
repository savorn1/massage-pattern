import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WorkplaceMemberRole } from '@/modules/shared/entities';

export class UpdateWorkplaceMemberRoleDto {
  @ApiProperty({
    description: 'New member role',
    enum: WorkplaceMemberRole,
  })
  @IsEnum(WorkplaceMemberRole)
  role: WorkplaceMemberRole;
}
