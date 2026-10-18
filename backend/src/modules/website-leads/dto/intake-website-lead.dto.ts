import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  trimToLowerCaseEmail,
  trimToUndefined,
} from '../../../common/utils/transform.util';

export enum WebsiteInquiryType {
  QUOTE = 'QUOTE',
  PART_REQUEST = 'PART_REQUEST',
}

export class IntakeWebsiteLeadDto {
  @IsEnum(WebsiteInquiryType)
  source: WebsiteInquiryType;

  @IsUUID()
  externalSubmissionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sourceFormId: string;

  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(1000)
  sourcePageUrl: string;

  @IsDateString()
  submittedAt: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  customerName?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerPhone?: string;

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

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(10)
  vehicleYear?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  vehicleMake?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  vehicleModel?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vin?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  partRequested?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean;
}
