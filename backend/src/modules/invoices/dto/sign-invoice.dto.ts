import { IsString, MaxLength, MinLength } from 'class-validator';

export class SignInvoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  customerSignature!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(250000)
  customerSignatureImage!: string;
}
