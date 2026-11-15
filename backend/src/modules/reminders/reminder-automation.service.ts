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
  ruleStillApplies,
  sourceSuggestionAccess,
} from './reminder-suggestions';
import {
  AcceptReminderSuggestionDto,
  CreateReminderTypeDto,
  UpdateReminderRuleDto,
  UpdateReminderTypeDto,
} from './dto/reminder-automation.dto';
import { ReminderAssignment } from './dto/create-reminder.dto';
import { Role } from '../../common/enums/role.enum';
@Injectable()
export class ReminderAutomationService {
  constructor(
    private readonly repo: RemindersRepository,
    private readonly core: RemindersService,
  ) {}
  async accept(
    id: string,
    input: AcceptReminderSuggestionDto,
    user: AuthenticatedUser,
    now = new Date(),
  ) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      const suggestion = await tx.reminderSuggestion.findUniqueOrThrow({
        where: { id },
        include: { rule: true },
      });
      const record = await sourceSuggestionAccess(
        tx,
        suggestion.context,
        suggestion.recordId,
        user,
      );
      if (
        suggestion.status !== 'PENDING' ||
        suggestion.version !== input.version ||
        suggestion.rule.version !== input.ruleVersion ||
        !(await ruleStillApplies(tx, suggestion.rule, suggestion.recordId))
      )
        throw new ConflictException(
          'This suggestion changed or is no longer applicable. Refresh the record.',
        );
      if (
        record.closed ||
        input.context !== suggestion.context ||
        input.recordId !== suggestion.recordId ||
        input.typeKey !== suggestion.rule.typeKey ||
        (input.assignment ?? 'RECORD_OWNER') !== suggestion.rule.assignment
      )
        throw new BadRequestException(
          'Suggestion fields do not match the current record rule.',
        );
      const changed = await tx.reminderSuggestion.updateMany({
        where: { id, status: 'PENDING', version: input.version },
        data: {
          status: 'ACCEPTED',
          decidedAt: now,
          decidedById: user.userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('The suggestion was already handled.');
      const { version, ruleVersion, ...payload } = input;
      const created = await this.core.createInTransaction(
        tx,
        {
          ...payload,
          assignment: suggestion.rule.assignment as ReminderAssignment,
        },
        user,
        now,
      );
      await tx.reminderSuggestion.update({
        where: { id },
        data: { acceptedReminderId: created.id },
      });
      return created;
    });
  }
  dismiss(id: string, version: number, user: AuthenticatedUser) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      const row = await tx.reminderSuggestion.findUniqueOrThrow({
        where: { id },
      });
      await sourceSuggestionAccess(tx, row.context, row.recordId, user);
      const result = await tx.reminderSuggestion.updateMany({
        where: { id, version, status: 'PENDING' },
        data: {
          status: 'DISMISSED',
          version: { increment: 1 },
          decidedAt: new Date(),
          decidedById: user.userId,
        },
      });
      if (result.count !== 1)
        throw new ConflictException('The suggestion was already handled.');
      return { id };
    });
  }
  settings(user: AuthenticatedUser) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      if (user.role !== 'ADMIN') throw new ForbiddenException();
      const [types, rules] = await Promise.all([
        tx.reminderType.findMany({ orderBy: { label: 'asc' } }),
        tx.reminderSuggestionRule.findMany({
          orderBy: [{ context: 'asc' }, { key: 'asc' }],
        }),
      ]);
      return { types, rules };
    });
  }
  createType(input: CreateReminderTypeDto, user: AuthenticatedUser) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      if (user.role !== 'ADMIN') throw new ForbiddenException();
      if (!input.allowedRoles.includes(Role.ADMIN))
        throw new BadRequestException(
          'Admin must retain access to every reminder type.',
        );
      if (await tx.reminderType.findUnique({ where: { key: input.key } }))
        throw new ConflictException('This type key already exists.');
      const row = await tx.reminderType.create({
        data: {
          key: input.key,
          label: input.label.trim(),
          allowedRoles: input.allowedRoles,
        },
      });
      await tx.reminderAutomationAudit.create({
        data: {
          actorId: user.userId,
          action: 'TYPE_CREATED',
          subjectKey: row.key,
          changes: { after: row },
        },
      });
      return row;
    });
  }
  updateType(
    key: string,
    input: UpdateReminderTypeDto,
    user: AuthenticatedUser,
  ) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      if (user.role !== 'ADMIN') throw new ForbiddenException();
      const data = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      );
      if (
        !Object.keys(data).length ||
        Object.values(data).some((v) => v === null) ||
        (input.allowedRoles && !input.allowedRoles.includes(Role.ADMIN))
      )
        throw new BadRequestException(
          'Invalid type settings. Admin access is required.',
        );
      const before = await tx.reminderType.findUniqueOrThrow({
        where: { key },
      });
      const row = await tx.reminderType.update({
        where: { key },
        data: {
          ...data,
          ...(input.label ? { label: input.label.trim() } : {}),
        },
      });
      await tx.reminderAutomationAudit.create({
        data: {
          actorId: user.userId,
          action: 'TYPE_UPDATED',
          subjectKey: key,
          changes: { before, after: row },
        },
      });
      return row;
    });
  }
  updateRule(
    key: string,
    input: UpdateReminderRuleDto,
    user: AuthenticatedUser,
  ) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      if (user.role !== 'ADMIN') throw new ForbiddenException();
      const { version, ...inputData } = input,
        data = Object.fromEntries(
          Object.entries(inputData).filter(([, v]) => v !== undefined),
        );
      if (
        !Object.keys(data).length ||
        Object.entries(data).some(([k, v]) => v === null && k !== 'repeatDays')
      )
        throw new BadRequestException('Provide valid rule settings.');
      const before = await tx.reminderSuggestionRule.findUniqueOrThrow({
        where: { key },
      });
      const changed = await tx.reminderSuggestionRule.updateMany({
        where: { key, version },
        data: { ...data, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'The suggestion rule changed. Reload settings.',
        );
      await tx.reminderAutomationAudit.create({
        data: {
          actorId: user.userId,
          action: 'RULE_UPDATED',
          subjectKey: key,
          changes: { before: JSON.parse(JSON.stringify(before)), after: data },
        },
      });
      return tx.reminderSuggestionRule.findUniqueOrThrow({ where: { key } });
    });
  }
}
