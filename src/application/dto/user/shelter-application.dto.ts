import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class ShelterApplicationDto {
  @IsString()
  @Length(2, 100)
  shelter_name: string;

  @IsString()
  @Length(2, 80)
  shelter_city: string;

  @IsString()
  @Length(20, 2000)
  shelter_description: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  shelter_website?: string;

  @IsOptional()
  @IsString()
  @Length(6, 30)
  shelter_phone?: string;
}
