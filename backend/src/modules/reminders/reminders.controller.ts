import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { QueryRecordRemindersDto } from './dto/query-record-reminders.dto';
import { ReminderActionDto } from './dto/reminder-action.dto';
import { ReminderActionsService } from './reminder-actions.service';
import { ReminderQueriesService } from './reminder-queries.service';
import { RemindersService } from './reminders.service';
import { TaskWorkspaceService } from './task-workspace.service';
import {
  QueryTaskWorkspaceDto,
  QueryTaskRecordsDto,
  SeenTaskInboxDto,
  RescheduleTaskDto,
} from './dto/query-task-workspace.dto';

@Controller('reminders')
@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
@UseGuards(JwtAuthGuard, RoleGuard)
export class RemindersController {
  constructor(
    private readonly core: RemindersService,
    private readonly queries: ReminderQueriesService,
    private readonly actions: ReminderActionsService,
    private readonly workspace: TaskWorkspaceService,
  ) {}
  @Get('summary') summary(@CurrentUser() user: AuthenticatedUser) {
    return this.workspace.summary(user);
  }
  @Get('workspace') tasks(
    @Query() query: QueryTaskWorkspaceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workspace.list(query, user);
  }
  @Get('records') records(
    @Query() query: QueryTaskRecordsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workspace.records(query, user);
  }
  @Get('follow-ups') followUps(
    @Query() query: QueryTaskWorkspaceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workspace.followUps(query, user);
  }
  @Post('inbox/seen') seen(
    @Body() input: SeenTaskInboxDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workspace.seen(user, input.seenThrough);
  }
  @Patch(':id/reschedule') reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RescheduleTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workspace.reschedule(id, input.version, input.dueAt, user);
  }
  @Get('record') record(
    @Query() query: QueryRecordRemindersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queries.record(query, user);
  }
  @Post() create(
    @Body() input: CreateReminderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.core.create(input, user);
  }
  @Get(':id/history') history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queries.history(id, user);
  }
  @Patch(':id') mutate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReminderActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actions.mutate(id, input, user);
  }
}
