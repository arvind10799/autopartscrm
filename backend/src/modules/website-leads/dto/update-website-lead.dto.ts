import { IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { WebsiteLeadStatus } from '@prisma/client';

export class UpdateWebsiteLeadDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(WebsiteLeadStatus)
  status?: WebsiteLeadStatus;

  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;
}
