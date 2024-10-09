import { Category } from '@domain/listing/Category.enum';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class GetListingDto {
  @IsArray()
  @IsOptional()
  category: Category[];

  @IsString()
  @IsOptional()
  order: 'ASC' | 'DESC';
}
