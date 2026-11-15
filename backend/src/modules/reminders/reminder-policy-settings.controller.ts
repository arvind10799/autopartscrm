import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { ReminderPolicyDto } from './dto/reminder-policy.dto';
import { ReminderPolicySettingsService } from './reminder-policy-settings.service';
@Controller('reminders/policy')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
export class ReminderPolicySettingsController {
  constructor(private readonly service: ReminderPolicySettingsService) {}
  @Get() get(@CurrentUser() u: AuthenticatedUser) {
    return this.service.get(u);
  }
  @Patch() @Roles(Role.ADMIN) update(
    @Body() d: ReminderPolicyDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.update(d, u);
  }
}
