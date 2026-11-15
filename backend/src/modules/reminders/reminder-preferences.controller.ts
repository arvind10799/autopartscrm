import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { UpdateReminderPreferenceDto } from './dto/update-reminder-preference.dto';
import { ReminderPreferencesService } from './reminder-preferences.service';

@Controller('reminders/preferences')
@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
@UseGuards(JwtAuthGuard, RoleGuard)
export class ReminderPreferencesController {
  constructor(private readonly service: ReminderPreferencesService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.get(user.userId, user);
  }

  @Patch('me')
  updateMine(
    @Body() input: UpdateReminderPreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(user.userId, input, user);
  }

  @Get('users/:userId')
  @Roles(Role.ADMIN)
  getUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.get(userId, user);
  }

  @Patch('users/:userId')
  @Roles(Role.ADMIN)
  updateUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() input: UpdateReminderPreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(userId, input, user);
  }
}
