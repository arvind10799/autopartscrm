import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { ReminderReportDto } from './dto/reminder-report.dto';
import { QueryTaskWorkspaceDto } from './dto/query-task-workspace.dto';
import { ReminderReportsService } from './reminder-reports.service';
import { ReminderCalendarExportService } from './reminder-calendar-export.service';
@Controller('reminders')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
export class ReminderInsightsController {
  constructor(
    private readonly reports: ReminderReportsService,
    private readonly calendar: ReminderCalendarExportService,
  ) {}
  @Get('reports') @Roles(Role.ADMIN) report(
    @Query() q: ReminderReportDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.reports.list(q, u);
  }
  @Get('reports/export.xlsx') @Roles(Role.ADMIN) async exportReport(
    @Query() q: ReminderReportDto,
    @CurrentUser() u: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const buffer = await this.reports.export(q, u);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="follow-ups.xlsx"',
    );
    response.setHeader('Cache-Control', 'no-store');
    response.send(buffer);
  }
  @Get('calendar-export.ics') async exportCalendar(
    @Query() q: QueryTaskWorkspaceDto,
    @CurrentUser() u: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const buffer = await this.calendar.export(q, u);
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="crm-tasks.ics"',
    );
    response.setHeader('Cache-Control', 'no-store');
    response.send(buffer);
  }
}
