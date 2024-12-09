import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Category } from '@domain/listing/Category.enum';

export class CreateListingDto {
  @IsNotEmpty()
  @IsString()
  @Length(1, 50)
  title: string;

  @IsNotEmpty()
  @IsString()
  @Length(5, 500)
  description: string;

  @IsNotEmpty()
  @IsArray()
  images: {
    url: string;
    id: string;
  }[];

  @IsNotEmpty()
  @IsString()
  @Length(5, 500)
  address: string;

  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @IsEnum(Category)
  category: Category;

  @IsOptional()
  @IsString()
  date_of_birth: Date;

  @IsNotEmpty()
  @IsBoolean()
  is_vaccinated: boolean;

  @IsNotEmpty()
  @IsString()
  breed: string;

  @IsNotEmpty()
  @IsString()
  gender: 'male' | 'female';

  @IsOptional()
  urgent: boolean;
}
