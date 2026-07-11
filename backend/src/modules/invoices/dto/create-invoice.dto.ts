import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @MaxLength(50)
  invoiceNumber!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  salesAssistant?: string;

  @IsString()
  @MaxLength(160)
  customerName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  billingAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shippingAddress?: string;

  @IsString()
  @MaxLength(80)
  shippingVendor!: string;

  @IsString()
  @MaxLength(120)
  deliveryTimeline!: string;

  @IsString()
  @MaxLength(255)
  itemDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  vehiclePartDescription?: string;

  @IsInt()
  @Min(1)
  @Max(9999)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  saleAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentStatus?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  paymentSource?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingCost!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salesTaxes!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  coreCharge!: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  customerSignature?: string;

  @IsOptional()
  @IsDateString()
  signatureDate?: string;
}
