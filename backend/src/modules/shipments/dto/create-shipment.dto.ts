import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ShipmentStatus } from '../../../common/enums/shipment-status.enum';
import {
  trimToUndefined,
} from '../../../common/utils/transform.util';

export class CreateShipmentDto {
  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bolNumber?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pickupNumber?: string;

  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @Transform(({ value }) => trimToUndefined(value))
  @ValidateIf(
    (dto: CreateShipmentDto) =>
      dto.status === ShipmentStatus.SHIPPED || dto.carrierName !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  carrierName?: string;

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

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  costNotes?: string;
}
