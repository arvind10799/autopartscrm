import { IsISO8601, IsOptional } from 'class-validator';

export class DateRangeQueryDto {
  @IsOptional()
  @IsISO8601(
    {},
    {
      message: 'createdFrom must be a valid ISO 8601 timestamp.',
    },
  )
  createdFrom?: string;

  @IsOptional()
  @IsISO8601(
    {},
    {
      message: 'createdTo must be a valid ISO 8601 timestamp.',
    },
  )
  createdTo?: string;
}
