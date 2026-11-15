import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DISPLAY_TIME_ZONES } from '../reminder-time';
export class ReminderReportDto {
  @IsIn([
    'LEADS_NO_NEXT',
    'WEBSITE_NO_NEXT',
    'UNSIGNED',
    'UNCHECKED_SHIPMENTS',
    'PERFORMANCE',
  ])
  kind: string = 'LEADS_NO_NEXT';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() @MaxLength(50) typeKey?: string;
  @IsOptional() @IsIn(DISPLAY_TIME_ZONES) displayTimeZone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page: number =
    1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number =
    20;
}
