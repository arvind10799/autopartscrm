import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { LeadStatus } from '@prisma/client';

export class QueryAgentLeadsDashboardDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month must use YYYY-MM format.',
  })
  month?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must use YYYY-MM-DD format.',
  })
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use YYYY-MM-DD format.',
  })
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;
}
