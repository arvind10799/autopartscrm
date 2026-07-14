import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SignInvoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  customerSignature!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(250000)
  customerSignatureImage!: string;

  @IsOptional()
  @IsString()
  @Matches(/^data:application\/pdf;base64,/, {
    message: 'Signed invoice PDF is invalid.',
  })
  @MaxLength(8000000)
  signedInvoicePdfBase64?: string;
}
