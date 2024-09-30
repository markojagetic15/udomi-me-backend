import { IsEmail, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsEmail()
  email?: string;

  @IsString()
  first_name?: string;

  @IsString()
  last_name?: string;
}
