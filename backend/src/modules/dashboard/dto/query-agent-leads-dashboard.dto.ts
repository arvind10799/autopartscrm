import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { LeadStatus } from '@prisma/client';

export class QueryAgentLeadsDashboardDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month must use YYYY-MM format.',
  })
  month?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;
}
