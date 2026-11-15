import { readReminderPolicy } from './reminder-policy-settings';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateReminderPreferenceDto } from './dto/update-reminder-preference.dto';
import {
  DEFAULT_REMINDER_TIME_ZONE,
  DISPLAY_TIME_ZONES,
} from './reminder-time';

export const DEFAULT_REMINDER_PREFERENCES = {
  displayTimeZone: DEFAULT_REMINDER_TIME_ZONE,
  workingStartMinute: 540,
  workingEndMinute: 1020,
  dailyDigestEnabled: true,
};

@Injectable()
export class ReminderPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, actor: AuthenticatedUser) {
    this.assertAccess(userId, actor);
    await this.requireUser(userId);
    return (
      (await this.prisma.reminderUserPreference.findUnique({
        where: { userId },
      })) ?? {
        userId,
        ...DEFAULT_REMINDER_PREFERENCES,
        displayTimeZone: (await readReminderPolicy(this.prisma))
          .defaultDisplayTimeZone,
      }
    );
  }

  async update(
    userId: string,
    input: UpdateReminderPreferenceDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAccess(userId, actor);
    const data: UpdateReminderPreferenceDto = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
    const keys = Object.keys(DEFAULT_REMINDER_PREFERENCES);
    if (
      !Object.keys(data).length ||
      Object.entries(data).some(
        ([key, value]) =>
          !keys.includes(key) || value === null || value === undefined,
      )
    )
      throw new BadRequestException('Invalid reminder preferences.');
    if (
      input.displayTimeZone !== undefined &&
      !(DISPLAY_TIME_ZONES as readonly string[]).includes(input.displayTimeZone)
    )
      throw new BadRequestException('Unsupported display time zone.');
    for (const value of [input.workingStartMinute, input.workingEndMinute]) {
      if (
        value !== undefined &&
        (!Number.isInteger(value) || value < 0 || value > 1439)
      )
        throw new BadRequestException(
          'Working hours must use minutes from 0 to 1439.',
        );
    }
    if (
      input.dailyDigestEnabled !== undefined &&
      typeof input.dailyDigestEnabled !== 'boolean'
    )
      throw new BadRequestException('Daily digest preference must be boolean.');
    const existing = await this.get(userId, actor);
    if (
      (data.workingStartMinute ?? existing.workingStartMinute) ===
      (data.workingEndMinute ?? existing.workingEndMinute)
    )
      throw new BadRequestException(
        'Working hours must have different start and end times.',
      );
    try {
      return await this.prisma.reminderUserPreference.upsert({
        where: { userId },
        create: { userId, displayTimeZone: existing.displayTimeZone, ...data },
        update: data,
      });
    } catch (error) {
      // The database also protects against concurrent partial updates forming invalid hours.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2004'
      )
        throw new BadRequestException('Invalid reminder preferences.');
      throw error;
    }
  }

  private assertAccess(userId: string, actor: AuthenticatedUser) {
    if (actor.role !== Role.ADMIN && actor.userId !== userId)
      throw new ForbiddenException(
        'You can change only your own reminder preferences.',
      );
  }

  private async requireUser(userId: string) {
    if (
      !(await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('User was not found.');
  }
}
