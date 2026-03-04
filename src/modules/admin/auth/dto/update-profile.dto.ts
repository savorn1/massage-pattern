import { IsString, IsEmail, IsOptional, IsUrl, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  // Allow empty string (clearing the field) or a valid URL
  @ValidateIf(o => o.avatar !== undefined && o.avatar !== '')
  @IsUrl({ require_tld: false })
  @IsOptional()
  avatar?: string;

  @ValidateIf(o => o.coverImage !== undefined && o.coverImage !== '')
  @IsUrl({ require_tld: false })
  @IsOptional()
  coverImage?: string;
}
