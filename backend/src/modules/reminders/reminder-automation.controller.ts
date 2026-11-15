import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import {
  AcceptReminderSuggestionDto,
  CreateReminderTypeDto,
  DismissReminderSuggestionDto,
  UpdateReminderRuleDto,
  UpdateReminderTypeDto,
} from './dto/reminder-automation.dto';
import { ReminderAutomationService } from './reminder-automation.service';
@Controller('reminders/automation')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
export class ReminderAutomationController {
  constructor(private readonly service: ReminderAutomationService) {}
  @Post('suggestions/:id/accept') accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AcceptReminderSuggestionDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.accept(id, d, u);
  }
  @Post('suggestions/:id/dismiss') dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DismissReminderSuggestionDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.dismiss(id, d.version, u);
  }
  @Get('settings') @Roles(Role.ADMIN) settings(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.settings(u);
  }
  @Post('types') @Roles(Role.ADMIN) create(
    @Body() d: CreateReminderTypeDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.createType(d, u);
  }
  @Patch('types/:key') @Roles(Role.ADMIN) type(
    @Param('key') key: string,
    @Body() d: UpdateReminderTypeDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.updateType(key, d, u);
  }
  @Patch('rules/:key') @Roles(Role.ADMIN) rule(
    @Param('key') key: string,
    @Body() d: UpdateReminderRuleDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.updateRule(key, d, u);
  }
}
