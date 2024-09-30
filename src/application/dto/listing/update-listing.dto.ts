import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @Length(5, 50)
  title: string;

  @IsOptional()
  @Length(5, 500)
  description: string;

  @IsOptional()
  @IsArray()
  images: {
    url: string;
    id: string;
  }[];

  @IsOptional()
  @IsString()
  @Length(5, 500)
  address: string;

  @IsOptional()
  @IsString()
  phone_number: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  email: string;
}
