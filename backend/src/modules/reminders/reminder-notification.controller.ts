import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { ReminderNotificationService } from './reminder-notification.service';
import {
  ReminderAlertActionDto,
  ReminderNotificationSettingsDto,
  ReminderPushDto,
  RemoveReminderPushDto,
} from './dto/reminder-notification.dto';
@Controller('reminders/notifications')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
export class ReminderNotificationController {
  constructor(private readonly service: ReminderNotificationService) {}
  @Get('configuration') configuration(@CurrentUser() u: AuthenticatedUser) {
    return this.service.configuration(u);
  }
  @Get('settings') @Roles(Role.ADMIN) settings(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.settings(u);
  }
  @Patch('settings') @Roles(Role.ADMIN) update(
    @Body() d: ReminderNotificationSettingsDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.updateSettings(d, u);
  }
  @Post('subscribe') subscribe(
    @Body() d: ReminderPushDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.subscribe(d, u);
  }
  @Post('unsubscribe') unsubscribe(
    @Body() d: RemoveReminderPushDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.unsubscribe(d.endpoint, u);
  }
  @Get('alerts/:id') alert(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.alert(id, u);
  }
  @Post('alerts/:id') action(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReminderAlertActionDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.action(id, d, u);
  }
}
