import {
  IsArray,
  IsDate,
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
  @Length(5, 50)
  title: string;

  @IsNotEmpty()
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
  @IsDate()
  date_of_birth: Date;

  @IsNotEmpty()
  @IsString()
  is_vaccinated: boolean;

  @IsOptional()
  @IsString()
  breed: string;

  @IsNotEmpty()
  @IsString()
  gender: 'male' | 'female';
}
