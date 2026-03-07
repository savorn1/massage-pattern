import { WorkplacePlan, WorkplaceStatus } from '@/modules/shared/entities';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class UpdateWorkplaceDto {
  @ApiPropertyOptional({ description: 'Workplace name', example: 'Acme Corp' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Workplace plan',
    enum: WorkplacePlan,
  })
  @IsEnum(WorkplacePlan)
  @IsOptional()
  plan?: WorkplacePlan;

  @ApiPropertyOptional({
    description: 'Workplace status',
    enum: WorkplaceStatus,
  })
  @IsEnum(WorkplaceStatus)
  @IsOptional()
  status?: WorkplaceStatus;

  @ApiPropertyOptional({ description: 'Workplace cover image URL', example: 'https://...' })
  @ValidateIf(o => o.coverImage !== undefined && o.coverImage !== '')
  @IsUrl({ require_tld: false })
  @IsOptional()
  coverImage?: string;
}
