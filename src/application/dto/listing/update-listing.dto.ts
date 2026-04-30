import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  title: string;

  @IsOptional()
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

  @IsOptional()
  @IsString()
  phone_number: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  date_of_birth: string;

  @IsOptional()
  @IsBoolean()
  is_vaccinated: boolean;

  @IsOptional()
  @IsString()
  breed: string;

  @IsOptional()
  @IsString()
  gender: 'male' | 'female';

  @IsOptional()
  @IsArray()
  interested_users: string[];

  @IsOptional()
  @IsBoolean()
  is_urgent: boolean;

  @IsOptional()
  @IsBoolean()
  is_adopted: boolean;

  @IsOptional()
  @IsBoolean()
  is_active: boolean;

  @IsOptional()
  @IsNumber()
  size: number;

  @IsOptional()
  @IsNumber()
  lat: number;

  @IsOptional()
  @IsNumber()
  lng: number;

  @IsOptional()
  @IsString()
  area_code: string;
}
