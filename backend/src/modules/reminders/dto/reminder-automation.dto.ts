import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum';
import { CreateReminderDto } from './create-reminder.dto';
export class AcceptReminderSuggestionDto extends CreateReminderDto {
  @IsInt() @Min(1) version!: number;
  @IsInt() @Min(1) ruleVersion!: number;
}
export class DismissReminderSuggestionDto {
  @IsInt() @Min(1) version!: number;
}
export class CreateReminderTypeDto {
  @IsString() @Matches(/^USER_[A-Z0-9_]+$/) @MaxLength(50) key!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) label!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  allowedRoles!: Role[];
}
export class UpdateReminderTypeDto {
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(80) label?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  allowedRoles?: Role[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateReminderRuleDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(365) delayDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(525600) delayMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) repeatDays?: number | null;
}
