import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { WebsiteLeadStatus } from '@prisma/client';

export class QueryWebsiteLeadsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsEnum(WebsiteLeadStatus)
  status?: WebsiteLeadStatus;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
