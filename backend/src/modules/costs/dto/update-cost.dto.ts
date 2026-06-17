import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  IsString,
} from 'class-validator';
import {
  trimToUpperCase,
  trimToUndefined,
} from '../../../common/utils/transform.util';

export class UpdateCostDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchaseAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  additionalAmount?: number;

  @Transform(({ value }) => trimToUpperCase(value))
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
