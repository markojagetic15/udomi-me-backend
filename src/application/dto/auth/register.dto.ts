import {
  Equals,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

// At least one upper- and one lower-case letter plus a digit or symbol.
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).*$/;

export class RegisterDto {
  @IsString()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  // bcrypt ignores input beyond 72 bytes.
  @Length(8, 72)
  @Matches(PASSWORD_RULE, { message: 'password too weak' })
  password: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  first_name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  last_name: string;

  @IsOptional()
  @IsIn(['hr', 'en'])
  language?: 'hr' | 'en';

  // GDPR: explicit acceptance of the terms + privacy policy at signup.
  @Equals(true, { message: 'You must accept the terms and privacy policy' })
  accept_terms: boolean;
}
