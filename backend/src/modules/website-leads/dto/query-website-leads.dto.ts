import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { WebsiteLeadStatus } from '@prisma/client';

export const WEBSITE_LEAD_ASSIGNMENT_FILTERS = [
  'ALL',
  'UNASSIGNED',
  'MINE',
] as const;
export type WebsiteLeadAssignmentFilter =
  (typeof WEBSITE_LEAD_ASSIGNMENT_FILTERS)[number];

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

  @IsOptional()
  @IsIn(WEBSITE_LEAD_ASSIGNMENT_FILTERS)
  assignment?: WebsiteLeadAssignmentFilter;
}
