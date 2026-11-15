import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  Max,
  Min,
} from 'class-validator';
import { DISPLAY_TIME_ZONES } from '../reminder-time';
export class ReminderPolicyDto {
  @IsInt() @Min(1) policyVersion!: number;
  @IsBoolean() callingWindowEnabled!: boolean;
  @IsInt() @Min(0) @Max(1439) callingStartMinute!: number;
  @IsInt() @Min(0) @Max(1439) callingEndMinute!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(43200, { each: true })
  snoozeMinutes!: number[];
  @IsIn(DISPLAY_TIME_ZONES) defaultDisplayTimeZone!: string;
  @IsObject() stateTimeZones!: Record<string, string>;
}
