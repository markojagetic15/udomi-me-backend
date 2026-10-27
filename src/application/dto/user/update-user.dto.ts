import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

// PUT /me. Email changes aren't allowed here (would bypass verification).
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  first_name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  last_name?: string;

  @IsOptional()
  @IsIn(['hr', 'en'])
  language?: 'hr' | 'en';

  @IsOptional()
  @IsBoolean()
  email_notifications?: boolean;

  // Must be one of our own uploads (POST /upload), or null to remove.
  @IsOptional()
  @Matches(/^\/api\/uploads\/[0-9a-f-]{36}\.webp$/)
  avatar_url?: string | null;
}
