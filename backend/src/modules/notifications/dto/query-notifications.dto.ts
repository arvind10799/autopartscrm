import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryNotificationsDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}

