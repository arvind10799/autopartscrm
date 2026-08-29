import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { trimToUndefined } from '../../../common/utils/transform.util';

export enum RefundType {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
}

export class RefundOrderDto {
  @IsEnum(RefundType)
  refundType!: RefundType;

  @ValidateIf((payload: RefundOrderDto) => payload.refundType === RefundType.PARTIAL)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundDeductionAmount?: number;

  @ValidateIf((payload: RefundOrderDto) => payload.refundType === RefundType.PARTIAL)
  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  refundDeductionReason?: string;
}
