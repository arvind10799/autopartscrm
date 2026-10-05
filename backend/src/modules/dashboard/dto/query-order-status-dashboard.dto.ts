import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Matches,
  Min,
} from 'class-validator';

export class QueryOrderStatusDashboardDto {
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
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  ageingRange?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  overdueDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 20;
}
