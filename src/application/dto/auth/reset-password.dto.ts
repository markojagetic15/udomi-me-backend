import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { PASSWORD_RULE } from './register.dto';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsString()
  @Length(8, 72)
  @Matches(PASSWORD_RULE, { message: 'password too weak' })
  password: string;
}
