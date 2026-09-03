import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReplacementStatus } from '../../../common/enums/replacement-status.enum';

export class UpdateReplacementDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  yardUpdate?: string;

  @IsOptional()
  @IsEnum(ReplacementStatus)
  replacementStatus?: ReplacementStatus;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  replacementProNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  replacementCarrierName?: string;
}
