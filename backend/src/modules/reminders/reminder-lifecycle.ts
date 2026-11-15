import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, Reminder } from '@prisma/client';
import { resolveReminderTime } from './reminder-time';
import { resolveReminderRecord } from './reminder-record';
import { reminderEvent } from './reminder-delivery-events';
import { repeatEndReached, stopReminderSeries } from './reminder-repeat';

export const OPEN_REMINDER_STATUSES = ['OPEN', 'SNOOZED'] as const;
export function reminderRecordId(
  r: Pick<
    Reminder,
    | 'context'
    | 'websiteLeadId'
    | 'leadId'
    | 'orderId'
    | 'shipmentId'
    | 'replacementId'
  >,
) {
  return r.context === 'WEBSITE_LEAD'
    ? r.websiteLeadId
    : r.context === 'LEAD'
      ? r.leadId
      : r.context === 'SHIPMENT'
        ? r.shipmentId
        : r.context === 'REPLACEMENT'
          ? r.replacementId
          : r.orderId;
}

/** Must run inside the same transaction as the CRM mutation. No external messages or record activity writes. */
export async function reconcileReminders(
  tx: Prisma.TransactionClient,
  where: Prisma.ReminderWhereInput,
  actorId?: string,
  moveLeadReminders = true,
) {
  const rows = await tx.reminder.findMany({
    where: {
      AND: [
        where,
        { deletedAt: null, status: { in: [...OPEN_REMINDER_STATUSES] } },
      ],
    },
    include: { owner: { select: { role: true } } },
  });
  for (const row of rows) {
    let data: Prisma.ReminderUncheckedUpdateManyInput = {};
    let reason: string | null = null;
    let autoComplete = false;
    let record = await resolveReminderRecord(
      tx,
      row.context,
      reminderRecordId(row) ?? undefined,
    );
    if (row.context === 'WEBSITE_LEAD') {
      const inquiry = await tx.websiteLead.findUniqueOrThrow({
        where: { id: row.websiteLeadId! },
      });
      if (inquiry.status === 'CONVERTED' && inquiry.convertedLeadId) {
        if (
          row.seriesId &&
          (
            await tx.reminderSeries.findUniqueOrThrow({
              where: { id: row.seriesId },
            })
          ).stopStatus === 'CONVERTED'
        )
          reason = 'End status reached: CONVERTED';
        data = {
          context: 'LEAD',
          websiteLeadId: null,
          leadId: inquiry.convertedLeadId,
        };
        record = await resolveReminderRecord(
          tx,
          'LEAD',
          inquiry.convertedLeadId,
        );
      } else if (inquiry.status === 'CLOSED') reason = 'Inquiry closed';
      else if (inquiry.assignedToId === null && row.owner?.role !== 'ADMIN') {
        // Keep the former owner for audit; Admin handles it until assignment resumes.
        continue;
      }
    }
    if (row.context === 'LEAD') {
      const lead = await tx.lead.findUniqueOrThrow({
        where: { id: row.leadId! },
      });
      if (lead.convertedOrderId) {
        if (row.seriesId)
          reason = 'Repeating lead reminders stop at conversion';
        else if (!moveLeadReminders)
          reason = 'Lead converted; reminder transfer declined';
        else {
          data = {
            context: 'ORDER',
            leadId: null,
            orderId: lead.convertedOrderId,
          };
          record = await resolveReminderRecord(
            tx,
            'ORDER',
            lead.convertedOrderId,
          );
        }
      }
    }
    if (row.orderId) {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: row.orderId },
        select: {
          status: true,
          invoice: { select: { status: true, signedAt: true } },
        },
      });
      if (['CANCELLED', 'REFUNDED'].includes(order.status))
        reason = `Order ${order.status.toLowerCase()}`;
      else if (
        row.context === 'ORDER' &&
        row.typeKey === 'SIGNATURE_FOLLOW_UP' &&
        order.invoice?.signedAt
      )
        autoComplete = true;
    }
    if (row.context === 'SHIPMENT') {
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { id: row.shipmentId! },
        select: { status: true },
      });
      if (shipment.status === 'CANCELLED') reason = 'Shipment cancelled';
      else if (
        shipment.status === 'DELIVERED' &&
        row.typeKey === 'TRACKING_CHECK'
      )
        reason = 'Tracking stopped at Delivered';
    }
    if (row.context === 'REPLACEMENT') {
      const replacement = await tx.replacementRequest.findUniqueOrThrow({
        where: { id: row.replacementId! },
        select: { replacementStatus: true },
      });
      if (replacement.replacementStatus === 'DELIVERED')
        reason = 'Replacement delivered';
    }
    // Shipment Order tracking checks also stop when the associated shipment arrives.
    if (
      row.context === 'SHIPMENT_ORDER' &&
      row.typeKey === 'TRACKING_CHECK' &&
      (await tx.shipment.findFirst({
        where: { orderId: row.orderId!, status: 'DELIVERED' },
        select: { id: true },
      }))
    )
      reason = 'Tracking stopped at Delivered';
    if (record.closed && !reason && !data.context && !autoComplete)
      reason = 'Linked record closed';

    if (row.seriesId && !reason && !autoComplete) {
      const series = await tx.reminderSeries.findUniqueOrThrow({
        where: { id: row.seriesId },
      });
      const ended = await repeatEndReached(
        tx,
        { ...row, ...data } as Reminder,
        series.stopStatus,
      );
      if (ended && !ended.startsWith('Owner inactive')) reason = ended;
    }

    if (!reason && !autoComplete) {
      if (
        row.ownerKind === 'USER' &&
        row.context !== 'PERSONAL' &&
        row.owner?.role !== 'ADMIN' &&
        record.owner &&
        record.owner.id !== row.ownerUserId
      )
        data.ownerUserId = record.owner.id;
      if (row.context !== 'PERSONAL' && record.timeZone !== row.timeZone) {
        try {
          const schedule = resolveReminderTime(
            row.localDueAt,
            record.timeZone,
            new Date('1900-01-01T00:00Z'),
          );
          Object.assign(data, schedule);
          if (row.status === 'SNOOZED') data.snoozedUntil = schedule.dueAt;
        } catch {
          throw new BadRequestException(
            'A reminder falls on an ambiguous or unavailable time in the new customer time zone. Reschedule it before changing the customer state.',
          );
        }
      }
    }
    if (reason || autoComplete)
      Object.assign(data, {
        status: autoComplete && !reason ? 'COMPLETED' : 'CANCELLED',
        cancelReason: reason,
        completedAt: autoComplete && !reason ? new Date() : null,
        completedById: null,
        snoozedUntil: null,
        workingById: null,
        workingUntil: null,
      });
    if (!Object.keys(data).length) continue;
    const originalId = reminderRecordId(row);
    if (data.context && !row.originContext && originalId) {
      data.originContext = row.context;
      data.originRecordId = originalId;
    }
    const changed = await tx.reminder.updateMany({
      where: {
        id: row.id,
        version: row.version,
        deletedAt: null,
        status: { in: [...OPEN_REMINDER_STATUSES] },
      },
      data: {
        ...data,
        version: { increment: 1 },
        scheduleVersion: { increment: 1 },
        escalatedAt: null,
      },
    });
    if (changed.count !== 1)
      throw new ConflictException(
        'A linked reminder changed. Refresh the record and try again.',
      );
    await tx.reminderDelivery.updateMany({
      where: { reminderId: row.id, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'CANCELLED', lockedUntil: null },
    });
    const current = await tx.reminder.findUniqueOrThrow({
      where: { id: row.id },
    });
    if (row.seriesId) {
      if (reason || autoComplete)
        await stopReminderSeries(
          tx,
          row.seriesId,
          reason ?? 'Completed automatically by CRM event',
        );
      else if (data.timeZone)
        await tx.reminderSeries.update({
          where: { id: row.seriesId },
          data: { timeZone: current.timeZone, version: { increment: 1 } },
        });
    }
    if (reason || autoComplete) {
      await reminderEvent(tx, current, 'AUTO_CLOSED');
      if (row.notifyCreatorOnCompletion && row.createdById !== row.ownerUserId)
        await reminderEvent(tx, current, 'COMPLETED', [row.createdById]);
    } else if (data.ownerUserId || data.context || data.timeZone) {
      await reminderEvent(tx, current, 'ASSIGNED');
      if (
        data.ownerUserId &&
        row.ownerUserId &&
        row.ownerUserId !== current.ownerUserId
      )
        await reminderEvent(tx, current, 'REASSIGNED', [row.ownerUserId]);
    }
    await tx.reminderHistory.create({
      data: {
        reminderId: row.id,
        actorId,
        action: reason
          ? 'CANCELLED'
          : autoComplete
            ? 'COMPLETED'
            : 'REASSIGNED',
        changes: {
          reason,
          previousContext: row.context,
          previousRecordId: originalId,
          previousOwnerUserId: row.ownerUserId,
          previousTimeZone: row.timeZone,
          automatic: true,
        },
      },
    });
    if (
      (reason || autoComplete) &&
      row.orderId &&
      ['ORDER', 'SHIPMENT_ORDER', 'SHIPMENT', 'REPLACEMENT'].includes(
        row.context,
      )
    ) {
      const authorId =
        actorId ??
        (
          await tx.user.findFirst({
            where: { role: 'ADMIN', isActive: true },
            select: { id: true },
          })
        )?.id;
      if (authorId)
        await tx.note.create({
          data: {
            authorId,
            content: `Reminder "${row.title}": ${reason ?? 'completed automatically after invoice signing'}.`,
            ...(row.context === 'SHIPMENT'
              ? { entityType: 'SHIPMENT' as const, shipmentId: row.shipmentId! }
              : { entityType: 'ORDER' as const, orderId: row.orderId }),
          },
        });
    }
  }
}
