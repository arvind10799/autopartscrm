import { IsString, IsUUID } from 'class-validator';

export class GroupNotificationsDto {
  @IsString()
  entityType!: string;

  @IsUUID()
  entityId!: string;
}
