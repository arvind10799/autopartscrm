import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
export class ReminderNotificationSettingsDto {
  @IsOptional() @IsBoolean() deliveryEnabled?: boolean;
  @IsOptional() @IsInt() @Min(15) @Max(240) secondAlertMinutes?: number | null;
  @IsOptional() @IsInt() @Min(30) @Max(1440) escalationMinutes?: number | null;
  @IsOptional() @IsInt() @Min(30) @Max(480) workingMarkerMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) snoozeFlagCount?: number | null;
}
class PushKeysDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{87}$/) p256dh!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{22}$/) auth!: string;
}
export class ReminderPushDto {
  @IsString() @MaxLength(2048) endpoint!: string;
  @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
}
export class RemoveReminderPushDto {
  @IsString() @MaxLength(2048) endpoint!: string;
}
export class ReminderAlertActionDto {
  @IsIn(['COMPLETE', 'SNOOZE', 'WORK']) action!: 'COMPLETE' | 'SNOOZE' | 'WORK';
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsInt() @Min(1) @Max(43200) snoozeMinutes?: number;
  @IsOptional() @IsString() @MaxLength(1000) completionNote?: string;
}
