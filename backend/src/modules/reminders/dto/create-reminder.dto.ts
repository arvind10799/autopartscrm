import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReminderRepeatDto } from './reminder-repeat.dto';
import { ReminderContext, ReminderPriority } from '@prisma/client';
import { DISPLAY_TIME_ZONES } from '../reminder-time';

export enum ReminderAssignment {
  RECORD_OWNER = 'RECORD_OWNER',
  SELF = 'SELF',
  SHIPPING_QUEUE = 'SHIPPING_QUEUE',
  SALES_AGENT = 'SALES_AGENT',
}

export class CreateReminderDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ReminderRepeatDto)
  repeat?: ReminderRepeatDto;
  @IsOptional()
  @IsBoolean()
  acknowledgeDuplicate?: boolean;
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  title: string;

  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  @MaxLength(50)
  typeKey: string;

  @IsEnum(ReminderContext)
  context: ReminderContext;

  @IsOptional()
  @IsUUID()
  recordId?: string;

  @IsOptional()
  @IsEnum(ReminderAssignment)
  assignment?: ReminderAssignment;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  localDueAt: string;

  @IsOptional()
  @IsIn(DISPLAY_TIME_ZONES)
  timeZone?: string;

  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(840)
  utcOffsetMinutes?: number;

  @IsOptional()
  @IsEnum(ReminderPriority)
  priority?: ReminderPriority;

  @IsOptional()
  @IsIn([0, 5, 15, 30])
  earlyAlertMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  notifyCreatorOnCompletion?: boolean;
}
