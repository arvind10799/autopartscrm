import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min, IsIn } from 'class-validator';

export class QueryNotificationsDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  @Transform(({ obj, key }) =>
    obj[key] === 'true' ? true : obj[key] === 'false' ? false : obj[key],
  )
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
  @IsOptional() @IsIn(['REMINDERS']) category?: 'REMINDERS';
}
