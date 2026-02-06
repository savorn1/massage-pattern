import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { WorkplacePlan, WorkplaceStatus } from '@/modules/shared/entities';

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
}
