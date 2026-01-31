import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// ════════════════════════════════════════════════════════════════════════════
// Pagination DTO
// ════════════════════════════════════════════════════════════════════════════

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ════════════════════════════════════════════════════════════════════════════
// Search DTO
// ════════════════════════════════════════════════════════════════════════════

export class SearchDto extends PaginationDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  filter?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// ID Parameter DTO
// ════════════════════════════════════════════════════════════════════════════

export class IdParamDto {
  @IsString()
  id: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Date Range DTO
// ════════════════════════════════════════════════════════════════════════════

export class DateRangeDto {
  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  endDate?: Date;
}

// ════════════════════════════════════════════════════════════════════════════
// Batch Operation DTO
// ════════════════════════════════════════════════════════════════════════════

export class BatchIdsDto {
  @IsString({ each: true })
  ids: string[];
}
