import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetMessagesQueryDto {
  // ── Page-based pagination ────────────────────────────────────────────────

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  // ── Cursor-based pagination (mutually exclusive with page) ───────────────

  /** ISO-8601 date — return messages strictly older than this timestamp */
  @IsOptional()
  @IsDateString()
  before?: string;

  /** ISO-8601 date — return messages strictly newer than this timestamp */
  @IsOptional()
  @IsDateString()
  after?: string;
}
