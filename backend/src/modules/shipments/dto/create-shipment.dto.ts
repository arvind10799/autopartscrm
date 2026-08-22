import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ShipmentStatus } from '../../../common/enums/shipment-status.enum';
import {
  trimToUndefined,
} from '../../../common/utils/transform.util';

export class CreateShipmentDto {
  @Transform(({ value }) => trimToUndefined(value))
  @ValidateIf(
    (dto: CreateShipmentDto) =>
      dto.status === ShipmentStatus.SHIPPED || dto.bolNumber !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  bolNumber?: string;

  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrierName?: string;
}
