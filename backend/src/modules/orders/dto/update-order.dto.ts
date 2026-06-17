import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  trimToLowerCaseEmail,
  trimToUndefined,
} from '../../../common/utils/transform.util';

export class UpdateOrderDto {
  @Transform(({ value }) => trimToLowerCaseEmail(value))
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  customerEmail?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
