import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DISPLAY_TIME_ZONES } from '../reminder-time';

export class UpdateReminderPreferenceDto {
  @IsOptional()
  @IsIn(DISPLAY_TIME_ZONES)
  displayTimeZone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  workingStartMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  workingEndMinute?: number;

  @IsOptional()
  @IsBoolean()
  dailyDigestEnabled?: boolean;
}
