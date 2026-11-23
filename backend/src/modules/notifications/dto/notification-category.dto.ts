import { IsIn, IsOptional } from 'class-validator';

export type NotificationCategory = 'GENERAL' | 'REMINDERS';

export class NotificationCategoryDto {
  @IsOptional()
  @IsIn(['GENERAL', 'REMINDERS'])
  category?: NotificationCategory;
}
