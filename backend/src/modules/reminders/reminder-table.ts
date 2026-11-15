import { ForbiddenException } from '@nestjs/common';
import { Prisma, ReminderContext } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

export const actionableLeadStatuses = [
  'PROSPECT',
  'QUOTED',
  'CALL_BACK_LATER',
  'SHOPPING_AROUND',
] as const;
export function tableReminderScope(
  context: ReminderContext,
  user: AuthenticatedUser,
): Prisma.ReminderWhereInput {
  if (user.role === 'ADMIN') return { context };
  if (user.role === 'SHIPPING') return { context, ownerKind: 'SHIPPING_QUEUE' };
  if (!['WEBSITE_LEAD', 'LEAD', 'ORDER'].includes(context))
    return { id: { in: [] } };
  return {
    context,
    ownerKind: 'USER',
    ownerUserId: user.userId,
    ...(context === 'WEBSITE_LEAD'
      ? { websiteLead: { assignedToId: user.userId } }
      : context === 'LEAD'
        ? { lead: { createdById: user.userId } }
        : { order: { createdById: user.userId } }),
  };
}
export function orderReminderContext(
  user: AuthenticatedUser,
  requested?: 'ORDER' | 'SHIPMENT_ORDER',
) {
  if (user.role === 'SALES' && requested === 'SHIPMENT_ORDER')
    throw new ForbiddenException('Sales uses order follow-ups.');
  return requested ?? (user.role === 'SHIPPING' ? 'SHIPMENT_ORDER' : 'ORDER');
}
export function futureReminderWhere(
  context: ReminderContext,
  user: AuthenticatedUser,
  now = new Date(),
): Prisma.ReminderWhereInput {
  return {
    ...tableReminderScope(context, user),
    deletedAt: null,
    status: { in: ['OPEN', 'SNOOZED'] },
    dueAt: { gt: now },
  };
}
export type TableFollowUp = {
  id: string;
  typeLabel: string;
  dueAt: Date;
  timeZone: string;
  status: string;
  overdue: boolean;
};
export type WithTableFollowUp<T> = T & { followUp: TableFollowUp | null };
type Db = Prisma.TransactionClient;
/** One bounded relation query per 100 records. Never expose notes, titles or another agent's tasks. */
export async function attachTableFollowUps<T extends { id: string }>(
  db: Db,
  items: T[],
  context: ReminderContext,
  user: AuthenticatedUser,
  now = new Date(),
  typeKey?: string,
): Promise<WithTableFollowUp<T>[]> {
  const byId = new Map<string, TableFollowUp>();
  if (
    user.role === 'SALES' &&
    !['WEBSITE_LEAD', 'LEAD', 'ORDER'].includes(context)
  )
    return items.map((item) => ({ ...item, followUp: null }));
  const reminders = {
    where: {
      ...tableReminderScope(context, user),
      ...(typeKey ? { typeKey } : {}),
      deletedAt: null,
      status: { in: ['OPEN', 'SNOOZED'] },
    },
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    take: 1,
    select: {
      id: true,
      dueAt: true,
      snoozedUntil: true,
      timeZone: true,
      status: true,
      type: { select: { label: true } },
    },
  } satisfies Prisma.ReminderFindManyArgs;
  for (let offset = 0; offset < items.length; offset += 100) {
    const where = {
        id: { in: items.slice(offset, offset + 100).map((r) => r.id) },
      },
      select = { id: true, reminders } as const;
    const rows =
      context === 'LEAD'
        ? await db.lead.findMany({ where, select })
        : context === 'WEBSITE_LEAD'
          ? await db.websiteLead.findMany({ where, select })
          : context === 'SHIPMENT'
            ? await db.shipment.findMany({ where, select })
            : await db.order.findMany({ where, select });
    for (const record of rows) {
      const r = record.reminders[0];
      if (r) {
        const dueAt = r.snoozedUntil ?? r.dueAt;
        byId.set(record.id, {
          id: r.id,
          typeLabel: r.type.label,
          dueAt,
          timeZone: r.timeZone,
          status: r.status === 'SNOOZED' && dueAt <= now ? 'OPEN' : r.status,
          overdue: dueAt < now,
        });
      }
    }
  }
  return items.map((item) => ({
    ...item,
    followUp: byId.get(item.id) ?? null,
  }));
}
export function exportFollowUp(value?: TableFollowUp | null) {
  return value
    ? `${value.typeLabel} | ${new Intl.DateTimeFormat('en-US', { timeZone: value.timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value.dueAt))} (${value.timeZone})${value.overdue ? ' | Overdue' : ''}`
    : '';
}
