import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { WorkplaceMemberRole } from '@/modules/shared/entities';

export class AddWorkplaceMemberDto {
  @ApiProperty({ description: 'User ID to add', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'Member role',
    enum: WorkplaceMemberRole,
    default: WorkplaceMemberRole.MEMBER,
  })
  @IsEnum(WorkplaceMemberRole)
  @IsOptional()
  role?: WorkplaceMemberRole;
}
