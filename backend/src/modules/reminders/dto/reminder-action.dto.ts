import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReminderRepeatDto } from './reminder-repeat.dto';
import { ReminderPriority } from '@prisma/client';
import { DISPLAY_TIME_ZONES } from '../reminder-time';

export enum ReminderCommand {
  EDIT = 'EDIT',
  COMPLETE = 'COMPLETE',
  SNOOZE = 'SNOOZE',
  CANCEL = 'CANCEL',
  DELETE = 'DELETE',
  WORK = 'WORK',
}
export class ReminderActionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ReminderRepeatDto)
  repeat?: ReminderRepeatDto;
  @IsOptional() @IsIn(['THIS', 'FUTURE']) repeatScope?: 'THIS' | 'FUTURE';
  @IsEnum(ReminderCommand) action: ReminderCommand;
  @IsInt() @Min(1) version: number;
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(50) typeKey?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsEnum(ReminderPriority) priority?: ReminderPriority;
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  localDueAt?: string;
  @IsOptional() @IsIn(DISPLAY_TIME_ZONES) timeZone?: string;
  @IsOptional() @IsInt() @Min(-720) @Max(840) utcOffsetMinutes?: number;
  @IsOptional() @IsIn([0, 5, 15, 30]) earlyAlertMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(43200) snoozeMinutes?: number;
  @IsOptional() @IsString() @MaxLength(1000) completionNote?: string;
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(255)
  cancelReason?: string;
}
