import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateSavedReplyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  /** Alphanumeric + hyphens/underscores, e.g. "standup" or "review-ready" */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_-]+$/, { message: 'shortcut must be lowercase alphanumeric with hyphens/underscores' })
  shortcut: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UpdateSavedReplyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_-]+$/, { message: 'shortcut must be lowercase alphanumeric with hyphens/underscores' })
  shortcut?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;
}
