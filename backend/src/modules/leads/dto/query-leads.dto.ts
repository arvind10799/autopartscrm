import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { LeadStatus } from '../../../common/enums/lead-status.enum';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryLeadsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  converted?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsUUID()
  createdById?: string;
}
