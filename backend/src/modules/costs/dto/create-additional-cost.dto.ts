import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { trimToUndefined } from '../../../common/utils/transform.util';

export class CreateAdditionalCostDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
