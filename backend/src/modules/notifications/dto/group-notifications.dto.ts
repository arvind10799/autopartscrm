import { IsString, IsUUID } from 'class-validator';
import { NotificationCategoryDto } from './notification-category.dto';

export class GroupNotificationsDto extends NotificationCategoryDto {
  @IsString()
  entityType!: string;

  @IsUUID()
  entityId!: string;
}
