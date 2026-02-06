import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';
import { WorkplacePlan } from '@/modules/shared/entities';

export class CreateWorkplaceDto {
  @ApiProperty({ description: 'Workplace name', example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Unique slug for the workplace',
    example: 'acme-corp',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Workplace plan',
    enum: WorkplacePlan,
    default: WorkplacePlan.FREE,
  })
  @IsEnum(WorkplacePlan)
  @IsOptional()
  plan?: WorkplacePlan;
}
