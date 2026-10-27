import { Type } from 'class-transformer';
import { EmptyToUndefined } from '@shared/empty-to-undefined';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Category } from '@domain/listing/Category.enum';
import { ListingImageDto } from './create-listing.dto';

// Same rules as CreateListingDto, all optional; listing_type is fixed at creation.
export class UpdateListingDto {
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Length(3, 60)
  title?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Length(5, 2000)
  description?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ListingImageDto)
  images?: ListingImageDto[];

  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(Category)
  category?: Category;

  // 'unknown' is allowed for found animals.
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['male', 'female', 'unknown'])
  gender?: 'male' | 'female' | 'unknown';

  @IsOptional()
  @EmptyToUndefined()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsDateString()
  event_date?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsNumber()
  @Min(0)
  @Max(200)
  size?: number;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Length(0, 60)
  breed?: string;

  @IsOptional() @IsBoolean() is_vaccinated?: boolean;
  @IsOptional() @IsBoolean() is_sterilized?: boolean;
  @IsOptional() @IsBoolean() is_microchipped?: boolean;
  @IsOptional() @IsBoolean() good_with_kids?: boolean;
  @IsOptional() @IsBoolean() good_with_dogs?: boolean;
  @IsOptional() @IsBoolean() good_with_cats?: boolean;
  @IsOptional() @IsBoolean() is_urgent?: boolean;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Length(0, 1000)
  medical_notes?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsNumber()
  @Min(0)
  @Max(10000)
  adoption_fee?: number | null;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Length(0, 200)
  address?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Length(0, 80)
  city?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Length(0, 8)
  area_code?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Matches(/^[0-9 ()+\-/]{0,30}$/)
  phone_number?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsEmail()
  email?: string;
}
