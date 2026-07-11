import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { LeadStatus } from '../../../common/enums/lead-status.enum';
import {
  trimString,
  trimToUndefined,
  trimToUpperCase,
} from '../../../common/utils/transform.util';

export class UpdateLeadDto {
  @IsOptional()
  @IsDateString()
  leadDate?: string;

  @Transform(({ value }) => trimToUpperCase(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cmpt?: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  customerName?: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  partDescription?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quote?: number;

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

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;
}
