import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { REPORT_REASONS, ReportReason } from '@domain/report/Report.entity';

export class AdoptListingDto {
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  adoption_story?: string;
}

export class ReportListingDto {
  @IsIn(REPORT_REASONS)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  details?: string;
}
