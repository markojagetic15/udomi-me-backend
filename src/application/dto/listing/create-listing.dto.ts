import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
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
  @Length(5, 2000)
  description: string;

  @IsOptional()
  @IsArray()
  images: {
    position: number;
    url: string;
    id: string;
  }[];

  @IsOptional()
  @IsString()
  @Length(5, 500)
  address: string;

  @IsString()
  @IsOptional()
  phone_number: string;

  @IsOptional()
  @IsString()
  area_code: string;

  @IsNotEmpty()
  @IsString()
  @IsEnum(Category)
  category: Category;

  @IsNotEmpty()
  @IsString()
  date_of_birth: Date;

  @IsNotEmpty()
  @IsBoolean()
  is_vaccinated: boolean;

  @IsOptional()
  @IsString()
  breed: string;

  @IsNotEmpty()
  @IsString()
  gender: 'male' | 'female';

  @IsOptional()
  @IsBoolean()
  is_urgent: boolean;

  @IsOptional()
  @IsNumber()
  size: number;

  @IsOptional()
  @IsNumber()
  lat: number;

  @IsOptional()
  @IsNumber()
  lng: number;
}
