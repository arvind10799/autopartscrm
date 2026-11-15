import { ReminderPolicySettingsService } from './reminder-policy-settings.service';
import { ReminderInsightsController } from './reminder-insights.controller';
import { ReminderReportsService } from './reminder-reports.service';
import { ReminderCalendarExportService } from './reminder-calendar-export.service';
import { ReminderPolicySettingsController } from './reminder-policy-settings.controller';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ReminderPreferencesController } from './reminder-preferences.controller';
import { ReminderPreferencesService } from './reminder-preferences.service';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { ReminderQueriesService } from './reminder-queries.service';
import { ReminderActionsService } from './reminder-actions.service';
import { TaskWorkspaceService } from './task-workspace.service';
import { ReminderNotificationService } from './reminder-notification.service';
import { ReminderNotificationController } from './reminder-notification.controller';
import { ReminderAutomationController } from './reminder-automation.controller';
import { ReminderAutomationService } from './reminder-automation.service';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule],
  controllers: [
    ReminderInsightsController,
    ReminderPolicySettingsController,
    ReminderPreferencesController,
    RemindersController,
    ReminderNotificationController,
    ReminderAutomationController,
  ],
  providers: [
    ReminderReportsService,
    ReminderCalendarExportService,
    ReminderPolicySettingsService,
    RemindersRepository,
    RemindersService,
    ReminderPreferencesService,
    ReminderQueriesService,
    ReminderActionsService,
    TaskWorkspaceService,
    ReminderNotificationService,
    ReminderAutomationService,
  ],
  exports: [RemindersService, RemindersRepository],
})
export class RemindersModule {}
