import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';
import {
  CUSTOMER_TIME_ZONES,
  US_STATE_CODES,
  customerTimeZone,
} from './reminder-time';
import { ReminderPolicyDto } from './dto/reminder-policy.dto';
import { readReminderPolicy } from './reminder-policy-settings';
@Injectable()
export class ReminderPolicySettingsService {
  constructor(
    private readonly repo: RemindersRepository,
    private readonly core: RemindersService,
  ) {}
  get(user: AuthenticatedUser) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      const policy = await readReminderPolicy(tx);
      return {
        ...policy,
        defaultStateTimeZones: Object.fromEntries(
          US_STATE_CODES.map((s) => [s, customerTimeZone(s)]),
        ),
      };
    });
  }
  update(input: ReminderPolicyDto, user: AuthenticatedUser) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      if (user.role !== 'ADMIN') throw new ForbiddenException();
      if (
        input.callingWindowEnabled &&
        input.callingStartMinute === input.callingEndMinute
      )
        throw new BadRequestException(
          'Choose different calling-window start and end times.',
        );
      if (
        Object.entries(input.stateTimeZones).some(
          ([state, zone]) =>
            !US_STATE_CODES.includes(state) ||
            !(CUSTOMER_TIME_ZONES as readonly unknown[]).includes(zone),
        )
      )
        throw new BadRequestException('Invalid state or customer time zone.');
      const before = await readReminderPolicy(tx),
        { policyVersion, ...data } = input;
      const changed = await tx.reminderSettings.updateMany({
        where: { id: 'default', policyVersion },
        data: {
          ...data,
          snoozeMinutes: [...data.snoozeMinutes].sort((a, b) => a - b),
          policyVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Reminder settings changed. Reload and try again.',
        );
      await tx.reminderAutomationAudit.create({
        data: {
          actorId: user.userId,
          action: 'POLICY_UPDATED',
          subjectKey: 'default',
          changes: { before: JSON.parse(JSON.stringify(before)), after: data },
        },
      });
      return readReminderPolicy(tx);
    });
  }
}
