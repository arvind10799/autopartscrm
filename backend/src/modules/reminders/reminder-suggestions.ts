import { ForbiddenException } from '@nestjs/common';
import {
  Prisma,
  ReminderContext,
  ReminderSuggestionRule,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SHIPPING_CONTEXTS } from './reminder-policy';
import { resolveReminderRecord } from './reminder-record';
import { localParts, resolveReminderTime } from './reminder-time';
import { taskDateShift } from './task-workspace-time';
import { shiftInstant } from './reminder-delivery-time';

export async function sourceSuggestionAccess(
  tx: Prisma.TransactionClient,
  context: ReminderContext,
  id: string,
  user: AuthenticatedUser,
) {
  const record = await resolveReminderRecord(tx, context, id);
  if (
    context === 'PERSONAL' ||
    (user.role === 'SALES' &&
      (SHIPPING_CONTEXTS.includes(context) ||
        record.owner?.id !== user.userId)) ||
    (user.role === 'SHIPPING' && !SHIPPING_CONTEXTS.includes(context))
  )
    throw new ForbiddenException(
      'Suggestions are available only in your record workspace.',
    );
  return record;
}
export async function ruleStillApplies(
  tx: Prisma.TransactionClient,
  rule: ReminderSuggestionRule,
  id: string,
) {
  if (!rule.isActive) return false;
  if (rule.context === 'WEBSITE_LEAD') {
    const r = await tx.websiteLead.findUnique({
      where: { id },
      select: { status: true, assignedTo: { select: { isActive: true } } },
    });
    return Boolean(
      r?.assignedTo?.isActive &&
      (rule.trigger === 'NEW_ASSIGNED'
        ? r.status === 'NEW'
        : r.status === rule.trigger),
    );
  }
  if (rule.context === 'LEAD') {
    const r = await tx.lead.findUnique({
      where: { id },
      select: { status: true, convertedOrderId: true },
    });
    return Boolean(r && !r.convertedOrderId && r.status === rule.trigger);
  }
  if (rule.context === 'ORDER' || rule.context === 'SHIPMENT_ORDER') {
    const r = await tx.order.findUnique({
      where: { id },
      select: {
        status: true,
        invoice: { select: { signatureRequestedAt: true, signedAt: true } },
        shipments: { select: { id: true } },
      },
    });
    return Boolean(
      r &&
      !['CANCELLED', 'REFUNDED'].includes(r.status) &&
      (rule.trigger === 'SIGNATURE_REQUEST'
        ? r.invoice?.signatureRequestedAt && !r.invoice.signedAt
        : r.status === rule.trigger &&
          (rule.context !== 'SHIPMENT_ORDER' || !r.shipments.length)),
    );
  }
  if (rule.context === 'SHIPMENT') {
    const r = await tx.shipment.findUnique({
      where: { id },
      select: {
        status: true,
        costs: { select: { hasActualPurchaseAmount: true } },
        order: { select: { status: true } },
      },
    });
    return Boolean(
      r &&
      r.status === rule.trigger &&
      !['CANCELLED', 'REFUNDED'].includes(r.order.status) &&
      (!rule.missingCostOnly ||
        !r.costs.some((c) => c.hasActualPurchaseAmount)),
    );
  }
  if (rule.context === 'REPLACEMENT') {
    const r = await tx.replacementRequest.findUnique({
      where: { id },
      select: { replacementStatus: true, order: { select: { status: true } } },
    });
    return Boolean(
      r &&
      r.replacementStatus === rule.trigger &&
      !['CANCELLED', 'REFUNDED'].includes(r.order.status),
    );
  }
  return false;
}
/** Publish only from a committed business-event transaction; reading a page never creates suggestions. */
export async function publishReminderSuggestions(
  tx: Prisma.TransactionClient,
  context: ReminderContext,
  recordId: string,
  trigger: string,
  now = new Date(),
) {
  const signature =
    trigger === 'SIGNATURE_REQUEST' || trigger === 'SIGNATURE_RESET';
  await tx.reminderSuggestion.updateMany({
    where: {
      context,
      recordId,
      status: 'PENDING',
      ...(signature
        ? { trigger: 'SIGNATURE_REQUEST' }
        : { trigger: { not: 'SIGNATURE_REQUEST' } }),
    },
    data: { status: 'SUPERSEDED', version: { increment: 1 } },
  });
  if (trigger === 'SIGNATURE_RESET') return;
  const rules = await tx.reminderSuggestionRule.findMany({
    where: { context, trigger, isActive: true, type: { isActive: true } },
  });
  const eligible: ReminderSuggestionRule[] = [];
  for (const rule of rules)
    if (await ruleStillApplies(tx, rule, recordId)) eligible.push(rule);
  if (!eligible.length) return;
  const eventId = randomUUID();
  await tx.reminderSuggestion.createMany({
    data: eligible.map((rule) => ({
      ruleKey: rule.key,
      eventId,
      context,
      recordId,
      trigger,
      createdAt: now,
    })),
    skipDuplicates: true,
  });
}
export function suggestionLocalTime(
  rule: Pick<
    ReminderSuggestionRule,
    'delayDays' | 'delayMinutes' | 'requiresTime'
  >,
  zone: string,
  createdAt: Date,
  now: Date,
) {
  if (rule.requiresTime) return null;
  if (rule.delayDays > 0) {
    const local = localParts(createdAt, zone),
      day = taskDateShift(local.slice(0, 10), rule.delayDays);
    const candidate = day + local.slice(10);
    // A late acceptance must never submit a date in the past. Offer a fresh future slot.
    return candidate > localParts(now, zone)
      ? candidate
      : localParts(new Date(now.getTime() + 3600000), zone);
  }
  return localParts(
    new Date(
      Math.max(
        createdAt.getTime() + rule.delayMinutes * 60000,
        now.getTime() + 60000,
      ),
    ),
    zone,
  );
}
export async function listReminderSuggestions(
  tx: Prisma.TransactionClient,
  context: ReminderContext,
  recordId: string,
  user: AuthenticatedUser,
  now = new Date(),
) {
  const record = await sourceSuggestionAccess(tx, context, recordId, user);
  if (record.closed) return [];
  const rows = await tx.reminderSuggestion.findMany({
    where: {
      context,
      recordId,
      status: 'PENDING',
      rule: { isActive: true, type: { isActive: true } },
    },
    include: {
      rule: {
        include: { type: { select: { label: true, allowedRoles: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const result: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const targetRole =
      row.rule.assignment === 'SALES_AGENT' ? record.owner?.role : undefined;
    if (
      !row.rule.type.allowedRoles.includes(user.role) &&
      !(
        targetRole &&
        row.rule.type.allowedRoles.some((role) => role === targetRole)
      )
    )
      continue;
    if (!(await ruleStillApplies(tx, row.rule, recordId))) continue;
    const localDueAt = suggestionLocalTime(
      row.rule,
      record.timeZone,
      row.createdAt,
      now,
    );
    const due = localDueAt
      ? shiftInstant(
          localDueAt.slice(0, 10),
          Number(localDueAt.slice(11, 13)) * 60 + Number(localDueAt.slice(14)),
          record.timeZone,
        )
      : null;
    const alreadyScheduled = Boolean(
      await tx.reminder.findFirst({
        where: {
          ...record.links,
          context,
          typeKey: row.rule.typeKey,
          deletedAt: null,
          status: { in: ['OPEN', 'SNOOZED'] },
          ...(due
            ? {
                dueAt: {
                  gte: new Date(due.getTime() - 3600000),
                  lte: new Date(due.getTime() + 3600000),
                },
              }
            : {}),
        },
        select: { id: true },
      }),
    );
    const safeLocalDueAt = due ? localParts(due, record.timeZone) : null;
    let requiresTime = row.rule.requiresTime;
    if (safeLocalDueAt) {
      try {
        resolveReminderTime(safeLocalDueAt, record.timeZone, now);
      } catch {
        requiresTime = true;
      }
    }
    result.push({
      id: row.id,
      version: row.version,
      ruleVersion: row.rule.version,
      label: row.rule.label,
      typeKey: row.rule.typeKey,
      typeLabel: row.rule.type.label,
      assignment: row.rule.assignment,
      localDueAt: safeLocalDueAt,
      timeZone: record.timeZone,
      requiresTime,
      alreadyScheduled,
      repeat: row.rule.repeatDays
        ? {
            frequency: 'EVERY_N_DAYS',
            intervalDays: row.rule.repeatDays,
            ...(row.rule.stopStatus ? { stopStatus: row.rule.stopStatus } : {}),
          }
        : undefined,
    });
  }
  return result;
}
