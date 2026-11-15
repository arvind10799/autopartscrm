import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
export class ReminderRepeatDto {
  @IsIn(['NONE', 'DAILY', 'EVERY_N_DAYS', 'WEEKLY']) frequency!:
    | 'NONE'
    | 'DAILY'
    | 'EVERY_N_DAYS'
    | 'WEEKLY';
  @IsOptional() @IsInt() @Min(1) @Max(365) intervalDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(6) weekday?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) untilDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) maxOccurrences?: number;
  @IsOptional()
  @IsIn(['DELIVERED', 'CANCELLED', 'REFUNDED', 'SIGNED', 'CLOSED', 'CONVERTED'])
  stopStatus?: string;
}
