import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimToUndefined } from '../../../common/utils/transform.util';

export class CancelOrderDto {
  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  cancellationReason!: string;
}
