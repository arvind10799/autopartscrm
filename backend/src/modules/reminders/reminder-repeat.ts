import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  Prisma,
  Reminder,
  ReminderContext,
  ReminderSeries,
} from '@prisma/client';
import { ReminderRepeatDto } from './dto/reminder-repeat.dto';
import { localParts } from './reminder-time';
import { taskDateShift } from './task-workspace-time';
import { shiftInstant } from './reminder-delivery-time';
import { resolveReminderRecord } from './reminder-record';
import { reminderEvent } from './reminder-delivery-events';

export const reminderSeriesSelect = {
  id: true,
  frequency: true,
  intervalDays: true,
  weekday: true,
  untilDate: true,
  maxOccurrences: true,
  stopStatus: true,
  isActive: true,
  version: true,
  completedCount: true,
  stopReason: true,
} as const;
export const repeatStopOptions: Record<ReminderContext, string[]> = {
  PERSONAL: [],
  WEBSITE_LEAD: ['CLOSED', 'CONVERTED'],
  LEAD: ['CONVERTED'],
  ORDER: ['DELIVERED', 'CANCELLED', 'REFUNDED', 'SIGNED'],
  SHIPMENT_ORDER: ['DELIVERED', 'CANCELLED', 'REFUNDED'],
  SHIPMENT: ['DELIVERED', 'CANCELLED', 'REFUNDED'],
  REPLACEMENT: ['DELIVERED', 'CANCELLED', 'REFUNDED'],
};
export function validateRepeat(
  input: ReminderRepeatDto | undefined,
  context: ReminderContext,
  localAt: string,
) {
  if (!input || input.frequency === 'NONE') {
    if (
      input &&
      Object.entries(input).some(
        ([k, v]) => k !== 'frequency' && v !== undefined,
      )
    )
      throw new BadRequestException(
        'A one-time task cannot have repeat options.',
      );
    return null;
  }
  if (Object.values(input).some((v) => v === null))
    throw new BadRequestException('Repeat options cannot be null.');
  if (input.intervalDays !== undefined && input.frequency !== 'EVERY_N_DAYS')
    throw new BadRequestException(
      'Every N days requires that repeat frequency.',
    );
  if (input.weekday !== undefined && input.frequency !== 'WEEKLY')
    throw new BadRequestException('A weekday requires weekly repetition.');
  if (input.frequency === 'EVERY_N_DAYS' && input.intervalDays === undefined)
    throw new BadRequestException('Choose the number of days.');
  if (input.untilDate) {
    taskDateShift(input.untilDate, 0);
    if (input.untilDate < localAt.slice(0, 10))
      throw new BadRequestException('Repeat end date precedes the first task.');
  }
  if (
    input.stopStatus &&
    !repeatStopOptions[context].includes(input.stopStatus)
  )
    throw new BadRequestException('Stop status is not valid for this record.');
  return {
    frequency: input.frequency,
    intervalDays:
      input.frequency === 'WEEKLY'
        ? 7
        : input.frequency === 'DAILY'
          ? 1
          : input.intervalDays!,
    weekday:
      input.frequency === 'WEEKLY'
        ? (input.weekday ??
          new Date(localAt.slice(0, 10) + 'T12:00Z').getUTCDay())
        : null,
    untilDate: input.untilDate ?? null,
    maxOccurrences: input.maxOccurrences ?? null,
    stopStatus: input.stopStatus ?? null,
  };
}
/** Advance by civil dates, keep the series clock, and skip missed occurrences in bounded work. */
export function nextRepeatTime(
  series: Pick<
    ReminderSeries,
    | 'frequency'
    | 'intervalDays'
    | 'weekday'
    | 'lastScheduledLocalAt'
    | 'timeZone'
    | 'untilDate'
  >,
  now: Date,
) {
  const last = series.lastScheduledLocalAt,
    clock = last.slice(11),
    minute = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  const firstStep =
    series.frequency === 'WEEKLY'
      ? (series.weekday! -
          new Date(last.slice(0, 10) + 'T12:00Z').getUTCDay() +
          7) %
          7 || 7
      : series.intervalDays;
  const first = taskDateShift(last.slice(0, 10), firstStep),
    today = localParts(now, series.timeZone).slice(0, 10);
  const step = series.frequency === 'WEEKLY' ? 7 : series.intervalDays;
  const difference = Math.floor(
    (Date.parse(today + 'T12:00Z') - Date.parse(first + 'T12:00Z')) / 86400000,
  );
  let day = taskDateShift(
    first,
    Math.max(0, Math.floor(difference / step)) * step,
  );
  for (let i = 0; i < 3; i++) {
    if (series.untilDate && day > series.untilDate) return null;
    const dueAt = shiftInstant(day, minute, series.timeZone);
    if (dueAt > now)
      return {
        dueAt,
        localDueAt: localParts(dueAt, series.timeZone),
        nominalLocalAt: `${day}T${clock}`,
      };
    day = taskDateShift(day, step);
  }
  throw new BadRequestException('Unable to calculate the next recurrence.');
}
export function repeatTemplate(
  row: Pick<
    Reminder,
    | 'title'
    | 'typeKey'
    | 'note'
    | 'priority'
    | 'earlyAlertMinutes'
    | 'notifyCreatorOnCompletion'
  >,
): Prisma.InputJsonObject {
  return {
    title: row.title,
    typeKey: row.typeKey,
    note: row.note,
    priority: row.priority,
    earlyAlertMinutes: row.earlyAlertMinutes,
    notifyCreatorOnCompletion: row.notifyCreatorOnCompletion,
  };
}
export async function stopReminderSeries(
  tx: Prisma.TransactionClient,
  id: string,
  reason: string,
  now = new Date(),
) {
  await tx.reminderSeries.updateMany({
    where: { id, isActive: true },
    data: {
      isActive: false,
      stoppedAt: now,
      stopReason: reason,
      version: { increment: 1 },
    },
  });
}
export async function repeatEndReached(
  tx: Prisma.TransactionClient,
  row: Reminder,
  stopStatus: string | null,
) {
  const id =
    row.context === 'WEBSITE_LEAD'
      ? row.websiteLeadId
      : row.context === 'LEAD'
        ? row.leadId
        : row.context === 'SHIPMENT'
          ? row.shipmentId
          : row.context === 'REPLACEMENT'
            ? row.replacementId
            : row.orderId;
  const record = await resolveReminderRecord(tx, row.context, id ?? undefined);
  if (record.closed) return 'Linked record closed or converted';
  if (row.ownerKind === 'USER' && row.ownerUserId) {
    const user = await tx.user.findUnique({
      where: { id: row.ownerUserId },
      select: { isActive: true, role: true },
    });
    if (
      !user?.isActive ||
      (row.context !== 'PERSONAL' && !['ADMIN', 'SALES'].includes(user.role))
    )
      return 'Owner inactive or no longer eligible';
  }
  if (!stopStatus) return null;
  let status: string | undefined;
  if (row.context === 'WEBSITE_LEAD')
    status = (
      await tx.websiteLead.findUnique({
        where: { id: row.websiteLeadId! },
        select: { status: true },
      })
    )?.status;
  else if (row.context === 'LEAD') {
    if (
      (
        await tx.lead.findUnique({
          where: { id: row.leadId! },
          select: { convertedOrderId: true },
        })
      )?.convertedOrderId
    )
      status = 'CONVERTED';
  } else if (row.context === 'SHIPMENT')
    status = (
      await tx.shipment.findUnique({
        where: { id: row.shipmentId! },
        select: { status: true },
      })
    )?.status;
  else if (row.context === 'REPLACEMENT')
    status = (
      await tx.replacementRequest.findUnique({
        where: { id: row.replacementId! },
        select: { replacementStatus: true },
      })
    )?.replacementStatus;
  else if (row.orderId) {
    const order = await tx.order.findUnique({
      where: { id: row.orderId },
      select: {
        status: true,
        invoice: { select: { signedAt: true } },
        shipments: { select: { status: true } },
      },
    });
    status =
      stopStatus === 'SIGNED' && order?.invoice?.signedAt
        ? 'SIGNED'
        : stopStatus === 'DELIVERED' &&
            order?.shipments.some((s) => s.status === 'DELIVERED')
          ? 'DELIVERED'
          : order?.status;
  }
  return status === stopStatus ? `End status reached: ${stopStatus}` : null;
}
export async function advanceReminderSeries(
  tx: Prisma.TransactionClient,
  row: Reminder,
  actorId: string,
  now: Date,
) {
  if (!row.seriesId) return null;
  const series = await tx.reminderSeries.findUniqueOrThrow({
    where: { id: row.seriesId },
  });
  if (!series.isActive) return null;
  const type = await tx.reminderType.findUnique({
    where: { key: (series.template as Prisma.JsonObject).typeKey as string },
    select: { isActive: true, allowedRoles: true },
  });
  const ownerRole =
    row.ownerKind === 'SHIPPING_QUEUE'
      ? 'SHIPPING'
      : (
          await tx.user.findUnique({
            where: { id: row.ownerUserId! },
            select: { role: true },
          })
        )?.role;
  const typeEligible =
    type?.isActive && ownerRole && type.allowedRoles.includes(ownerRole);
  const ended = await repeatEndReached(tx, row, series.stopStatus);
  const count = series.completedCount + 1;
  const next =
    ended ||
    !typeEligible ||
    (series.maxOccurrences !== null && count >= series.maxOccurrences)
      ? null
      : nextRepeatTime(series, now);
  const result = await tx.reminderSeries.updateMany({
    where: { id: series.id, version: series.version, isActive: true },
    data: {
      completedCount: count,
      version: { increment: 1 },
      ...(next
        ? { lastScheduledLocalAt: next.nominalLocalAt }
        : {
            isActive: false,
            stoppedAt: now,
            stopReason:
              ended ??
              (!typeEligible
                ? 'Reminder type disabled or unavailable to owner'
                : series.maxOccurrences !== null &&
                    count >= series.maxOccurrences
                  ? 'Occurrence limit reached'
                  : 'Repeat end date reached'),
          }),
    },
  });
  if (result.count !== 1)
    throw new ConflictException(
      'The repeating schedule changed. Refresh and try again.',
    );
  if (!next) return null;
  const template = series.template as Prisma.JsonObject;
  const created = await tx.reminder.create({
    data: {
      title: template.title as string,
      typeKey: template.typeKey as string,
      note: template.note as string | null,
      priority: template.priority as Reminder['priority'],
      earlyAlertMinutes: template.earlyAlertMinutes as number,
      notifyCreatorOnCompletion: template.notifyCreatorOnCompletion as boolean,
      context: row.context,
      originContext: row.originContext,
      originRecordId: row.originRecordId,
      websiteLeadId: row.websiteLeadId,
      leadId: row.leadId,
      orderId: row.orderId,
      shipmentId: row.shipmentId,
      replacementId: row.replacementId,
      ownerKind: row.ownerKind,
      ownerUserId: row.ownerUserId,
      createdById: row.createdById,
      assignedByAdmin: row.assignedByAdmin,
      isHandoff: row.isHandoff,
      seriesId: series.id,
      occurrenceNumber: row.occurrenceNumber! + 1,
      timeZone: series.timeZone,
      dueAt: next.dueAt,
      localDueAt: next.localDueAt,
      histories: {
        create: {
          actorId,
          action: 'CREATED',
          changes: {
            previousOccurrenceId: row.id,
            seriesId: series.id,
            occurrenceNumber: row.occurrenceNumber! + 1,
          },
        },
      },
    },
  });
  if (created.isHandoff || created.assignedByAdmin)
    await reminderEvent(tx, created, 'ASSIGNED', undefined, now);
  return created.id;
}
