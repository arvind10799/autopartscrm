import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ReminderContext } from '@prisma/client';

export class QueryRecordRemindersDto {
  @IsEnum(ReminderContext) context: ReminderContext;
  @IsOptional() @IsUUID() recordId?: string;
  @IsOptional()
  @Transform(({ obj }) =>
    obj.history === true || obj.history === 'true'
      ? true
      : obj.history === false || obj.history === 'false'
        ? false
        : obj.history,
  )
  @IsBoolean()
  history?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit: number =
    20;
}
