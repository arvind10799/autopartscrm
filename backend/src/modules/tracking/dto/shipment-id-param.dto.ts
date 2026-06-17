import { IsUUID } from 'class-validator';

export class ShipmentIdParamDto {
  @IsUUID()
  shipmentId: string;
}
