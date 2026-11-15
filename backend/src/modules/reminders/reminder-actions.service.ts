import { readReminderPolicy } from './reminder-policy-settings';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, ReminderHistoryAction } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ReminderActionDto } from './dto/reminder-action.dto';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';
import { localParts, resolveReminderTime } from './reminder-time';
import {
  advanceReminderSeries,
  repeatTemplate,
  stopReminderSeries,
  validateRepeat,
} from './reminder-repeat';

@Injectable()
export class ReminderActionsService {
  constructor(
    private readonly repository: RemindersRepository,
    private readonly core: RemindersService,
  ) {}
  async mutate(
    id: string,
    input: ReminderActionDto,
    user: AuthenticatedUser,
    now = new Date(),
  ) {
    const dto = plainToInstance(ReminderActionDto, input);
    if (
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length
    )
      throw new BadRequestException('Invalid reminder action.');
    const allowed: Record<string, string[]> = {
      EDIT: [
        'title',
        'typeKey',
        'note',
        'priority',
        'localDueAt',
        'timeZone',
        'utcOffsetMinutes',
        'earlyAlertMinutes',
        'repeat',
        'repeatScope',
      ],
      COMPLETE: ['completionNote'],
      SNOOZE: ['snoozeMinutes', 'localDueAt', 'utcOffsetMinutes'],
      CANCEL: ['cancelReason', 'repeatScope'],
      DELETE: [],
      WORK: [],
    };
    if (
      Object.entries(dto).some(
        ([key, value]) =>
          value !== undefined &&
          !['action', 'version', ...allowed[dto.action]].includes(key),
      )
    )
      throw new BadRequestException('Fields do not belong to this action.');
    if (Object.entries(dto).some(([, value]) => value === null))
      throw new BadRequestException(
        'Use empty text to clear a note; action fields cannot be null.',
      );
    if (dto.action === 'WORK')
      return this.core.markWorking(id, dto.version, user, now);
    return this.repository.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      const row = await this.repository.find(tx, id);
      const action =
        dto.action === 'CANCEL'
          ? 'edit'
          : (dto.action.toLowerCase() as
              | 'edit'
              | 'complete'
              | 'snooze'
              | 'delete');
      const record = await this.core.authorize(tx, row, user, action);
      if (
        dto.repeat !== undefined &&
        (dto.action !== 'EDIT' || dto.repeatScope !== 'FUTURE')
      )
        throw new BadRequestException(
          'Choose current and future occurrences to edit repetition.',
        );
      if (
        dto.repeatScope === 'FUTURE' &&
        !row.seriesId &&
        dto.repeat === undefined
      )
        throw new BadRequestException('This is not a repeating task.');
      if (!['OPEN', 'SNOOZED'].includes(row.status))
        throw new ConflictException('This reminder is already closed.');
      if (row.version !== dto.version)
        throw new ConflictException(
          'The reminder changed. Refresh and try again.',
        );
      if (record.closed)
        throw new ConflictException(
          'The linked record has closed or converted. Refresh the page.',
        );
      let data: Prisma.ReminderUncheckedUpdateManyInput = {};
      let event: ReminderHistoryAction = 'EDITED';
      let scheduleChanged = false;
      if (dto.action === 'EDIT') {
        scheduleChanged = true;
        if (!allowed.EDIT.some((key) => dto[key] !== undefined))
          throw new BadRequestException('Provide a field to edit.');
        if (dto.typeKey && dto.typeKey !== row.typeKey) {
          const type = await tx.reminderType.findUnique({
            where: { key: dto.typeKey },
          });
          if (!type?.isActive || !type.allowedRoles.includes(user.role))
            throw new BadRequestException(
              'Reminder type is not available for your role.',
            );
          data.typeKey = dto.typeKey;
        }
        if (dto.title !== undefined) data.title = dto.title.trim();
        if (dto.note !== undefined) data.note = dto.note.trim() || null;
        if (dto.priority !== undefined) data.priority = dto.priority;
        if (dto.earlyAlertMinutes !== undefined) {
          data.earlyAlertMinutes = dto.earlyAlertMinutes;
          scheduleChanged = true;
        }
        if (dto.timeZone !== undefined && row.context !== 'PERSONAL')
          throw new BadRequestException(
            'Customer time zones come from the linked record.',
          );
        if (dto.localDueAt || dto.timeZone) {
          Object.assign(
            data,
            resolveReminderTime(
              dto.localDueAt ?? row.localDueAt,
              row.context === 'PERSONAL'
                ? (dto.timeZone ?? row.timeZone)
                : record.timeZone,
              now,
              dto.utcOffsetMinutes,
            ),
          );
          if (row.status === 'SNOOZED') data.snoozedUntil = data.dueAt;
          scheduleChanged = true;
        } else if (row.dueAt <= now)
          throw new BadRequestException(
            'Choose a future due time when editing an overdue reminder.',
          );
      } else if (dto.action === 'SNOOZE') {
        if (
          dto.snoozeMinutes !== undefined &&
          ![15, 60, ...(await readReminderPolicy(tx)).snoozeMinutes].includes(
            dto.snoozeMinutes,
          )
        )
          throw new BadRequestException(
            'This snooze choice changed. Reload the reminder or choose a custom time.',
          );
        if (Boolean(dto.localDueAt) === Boolean(dto.snoozeMinutes))
          throw new BadRequestException(
            'Choose a snooze duration or a custom time.',
          );
        const zone =
          row.context === 'PERSONAL' ? row.timeZone : record.timeZone;
        const schedule = dto.localDueAt
          ? resolveReminderTime(dto.localDueAt, zone, now, dto.utcOffsetMinutes)
          : {
              dueAt: new Date(now.getTime() + dto.snoozeMinutes! * 60000),
              localDueAt: localParts(
                new Date(now.getTime() + dto.snoozeMinutes! * 60000),
                zone,
              ),
              timeZone: zone,
            };
        Object.assign(data, schedule, {
          status: 'SNOOZED',
          snoozedUntil: schedule.dueAt,
          snoozeCount: { increment: 1 },
          workingById: null,
          workingUntil: null,
        });
        event = 'SNOOZED';
        scheduleChanged = true;
      } else if (dto.action === 'COMPLETE') {
        Object.assign(data, {
          status: 'COMPLETED',
          completedAt: now,
          completedById: user.userId,
          completionNote: dto.completionNote?.trim() || null,
          snoozedUntil: null,
          workingById: null,
          workingUntil: null,
        });
        event = 'COMPLETED';
        scheduleChanged = true;
        if (dto.completionNote?.trim() && row.context !== 'PERSONAL') {
          const content =
            row.context === 'REPLACEMENT'
              ? `[Replacement follow-up] ${dto.completionNote.trim()}`
              : dto.completionNote.trim();
          const linked = row.websiteLeadId
            ? {
                entityType: 'WEBSITE_LEAD' as const,
                websiteLeadId: row.websiteLeadId,
              }
            : row.leadId
              ? { entityType: 'LEAD' as const, leadId: row.leadId }
              : row.context === 'SHIPMENT' ||
                  (row.context === 'REPLACEMENT' && row.shipmentId)
                ? {
                    entityType: 'SHIPMENT' as const,
                    shipmentId: row.shipmentId!,
                  }
                : { entityType: 'ORDER' as const, orderId: row.orderId! };
          await tx.note.create({
            data: { ...linked, content, authorId: user.userId },
          });
          if (row.leadId)
            await tx.lead.update({
              where: { id: row.leadId },
              data: { updatedAt: now },
            });
        }
      } else {
        Object.assign(data, {
          status: 'CANCELLED',
          cancelReason:
            dto.cancelReason?.trim() ||
            (dto.action === 'DELETE' ? 'Deleted by user' : 'Cancelled by user'),
          snoozedUntil: null,
          workingById: null,
          workingUntil: null,
        });
        if (dto.action === 'DELETE') data.deletedAt = now;
        event = dto.action === 'DELETE' ? 'DELETED' : 'CANCELLED';
        scheduleChanged = true;
      }
      if (scheduleChanged) {
        data.scheduleVersion = { increment: 1 };
        data.escalatedAt = null;
        await tx.reminderDelivery.updateMany({
          where: { reminderId: id, status: { in: ['PENDING', 'PROCESSING'] } },
          data: { status: 'CANCELLED', lockedUntil: null },
        });
      }
      const updated = await this.repository.updateWithHistory(
        tx,
        id,
        dto.version,
        data,
        user.userId,
        event,
        {
          previousStatus: row.status,
          previousDueAt: row.dueAt.toISOString(),
          previousTitle: row.title,
          ...(dto.repeatScope ? { repeatScope: dto.repeatScope } : {}),
          ...(dto.repeat
            ? { repeat: JSON.parse(JSON.stringify(dto.repeat)) }
            : {}),
          ...(dto.completionNote?.trim()
            ? { completionNote: dto.completionNote.trim() }
            : {}),
        },
      );
      if (dto.action === 'COMPLETE') {
        const nextOccurrenceId = await advanceReminderSeries(
          tx,
          updated,
          user.userId,
          now,
        );
        return { ...updated, nextOccurrenceId };
      }
      if (row.seriesId && ['CANCEL', 'DELETE'].includes(dto.action))
        await stopReminderSeries(tx, row.seriesId, 'Stopped by user', now);
      if (dto.action === 'EDIT' && dto.repeatScope === 'FUTURE') {
        const currentSeries = row.seriesId
          ? await tx.reminderSeries.findUniqueOrThrow({
              where: { id: row.seriesId },
            })
          : null;
        const repeat =
          dto.repeat === undefined
            ? null
            : validateRepeat(dto.repeat, row.context, updated.localDueAt);
        if (
          currentSeries &&
          repeat?.maxOccurrences !== null &&
          repeat?.maxOccurrences !== undefined &&
          repeat.maxOccurrences <= currentSeries.completedCount
        )
          throw new BadRequestException(
            'The occurrence limit must include the current occurrence.',
          );
        if (dto.repeat?.frequency === 'NONE' && row.seriesId)
          await stopReminderSeries(
            tx,
            row.seriesId,
            'Repetition removed by user',
            now,
          );
        else if (currentSeries) {
          if (!currentSeries.isActive)
            throw new BadRequestException(
              'The repeating schedule is stopped. Create a new repeating reminder.',
            );
          await tx.reminderSeries.update({
            where: { id: currentSeries.id },
            data: {
              ...(repeat ?? {}),
              template: repeatTemplate(updated),
              timeZone: updated.timeZone,
              lastScheduledLocalAt:
                dto.localDueAt ?? currentSeries.lastScheduledLocalAt,
              version: { increment: 1 },
            },
          });
        } else if (repeat) {
          const series = await tx.reminderSeries.create({
            data: {
              ...repeat,
              template: repeatTemplate(updated),
              timeZone: updated.timeZone,
              anchorLocalAt: updated.localDueAt,
              lastScheduledLocalAt: updated.localDueAt,
              createdById: updated.createdById,
            },
          });
          return tx.reminder.update({
            where: { id: updated.id },
            data: { seriesId: series.id, occurrenceNumber: 1 },
          });
        }
      }
      return updated;
    });
  }
}
