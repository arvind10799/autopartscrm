import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ReminderContext,
  ReminderPriority,
  ReminderStatus,
} from '@prisma/client';
import { DISPLAY_TIME_ZONES } from '../reminder-time';

export class QueryTaskWorkspaceDto {
  @IsOptional()
  @IsIn(['MINE', 'TEAM', 'QUEUE', 'SENT', 'UNASSIGNED'])
  scope: string = 'MINE';
  @IsOptional()
  @IsIn([
    'ALL',
    'OVERDUE',
    'TODAY',
    'UPCOMING',
    'HANDED',
    'NEW',
    'DONE',
    'CANCELLED',
  ])
  tab: string = 'ALL';
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsEnum(ReminderContext) context?: ReminderContext;
  @IsOptional() @IsString() @MaxLength(50) typeKey?: string;
  @IsOptional() @IsEnum(ReminderPriority) priority?: ReminderPriority;
  @IsOptional() @IsEnum(ReminderStatus) status?: ReminderStatus;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsIn(DISPLAY_TIME_ZONES) displayTimeZone?: string;
  @IsOptional()
  @Transform(({ obj }) =>
    obj.working === 'true'
      ? true
      : obj.working === 'false'
        ? false
        : obj.working,
  )
  @IsBoolean()
  working?: boolean;
  @IsOptional()
  @Transform(({ obj }) =>
    obj.flagged === 'true'
      ? true
      : obj.flagged === 'false'
        ? false
        : obj.flagged,
  )
  @IsBoolean()
  flagged?: boolean;
  @IsOptional()
  @Transform(({ obj }) =>
    obj.handoff === 'true'
      ? true
      : obj.handoff === 'false'
        ? false
        : obj.handoff,
  )
  @IsBoolean()
  handoff?: boolean;
  @IsOptional()
  @Transform(({ obj }) =>
    obj.calendar === 'true'
      ? true
      : obj.calendar === 'false'
        ? false
        : obj.calendar,
  )
  @IsBoolean()
  calendar?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page: number =
    1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit: number =
    20;
}
export class QueryTaskRecordsDto {
  @IsEnum(ReminderContext) context: ReminderContext;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
export class SeenTaskInboxDto {
  @IsISO8601({ strict: true }) seenThrough: string;
}
export class RescheduleTaskDto {
  @IsInt() @Min(1) version: number;
  @IsISO8601({ strict: true }) dueAt: string;
}
