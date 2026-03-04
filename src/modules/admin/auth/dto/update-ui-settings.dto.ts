import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUiSettingsDto {
  @ApiPropertyOptional({ enum: ['indigo', 'violet', 'blue', 'teal', 'rose'] })
  @IsOptional()
  @IsString()
  @IsIn(['indigo', 'violet', 'blue', 'teal', 'rose'])
  theme?: string;

  @ApiPropertyOptional({ enum: ['compact', 'default', 'comfortable'] })
  @IsOptional()
  @IsString()
  @IsIn(['compact', 'default', 'comfortable'])
  density?: string;

  @ApiPropertyOptional({ enum: ['sharp', 'default', 'pill'] })
  @IsOptional()
  @IsString()
  @IsIn(['sharp', 'default', 'pill'])
  radius?: string;

  @ApiPropertyOptional({ enum: ['default', 'glass', 'solid'] })
  @IsOptional()
  @IsString()
  @IsIn(['default', 'glass', 'solid'])
  cardStyle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reduceMotion?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sidebarCollapsed?: boolean;
}
