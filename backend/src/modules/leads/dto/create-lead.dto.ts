import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { LeadStatus } from '../../../common/enums/lead-status.enum';
import {
  trimString,
  trimToLowerCaseEmail,
  trimToUndefined,
  trimToUpperCase,
} from '../../../common/utils/transform.util';

export class CreateLeadDto {
  @IsDateString()
  leadDate: string;

  @Transform(({ value }) => trimToUpperCase(value))
  @IsString()
  @IsNotEmpty()
  @IsIn(['YES', 'NO'])
  @MaxLength(80)
  cmpt: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\(\d{3}\) \d{3}-\d{4}$/)
  customerPhone: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  customerName: string;

  @Transform(({ value }) => trimToLowerCaseEmail(value))
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  customerEmail?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  vehicleYear: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  vehicleMake: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  vehicleModel: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  vehicleVariant?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quote?: number;

  @Transform(({ value }) => trimToUpperCase(value))
  @IsOptional()
  @IsIn(['USD', 'CAD'])
  quoteCurrency?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  prospects?: string;

  @IsEnum(LeadStatus)
  status: LeadStatus;
}
