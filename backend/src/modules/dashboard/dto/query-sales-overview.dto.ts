import { IsOptional, Matches } from 'class-validator';

export class QuerySalesOverviewDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month must use YYYY-MM format.',
  })
  month?: string;
}
