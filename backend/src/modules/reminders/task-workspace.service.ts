import { readReminderPolicy } from './reminder-policy-settings';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReminderContext } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  QueryTaskWorkspaceDto,
  QueryTaskRecordsDto,
} from './dto/query-task-workspace.dto';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';
import { ReminderQueriesService } from './reminder-queries.service';
import { ReminderActionsService } from './reminder-actions.service';
import { isReminderStatusOnly, SHIPPING_CONTEXTS } from './reminder-policy';
import {
  customerTimeZone,
  DEFAULT_REMINDER_TIME_ZONE,
  localParts,
} from './reminder-time';
import {
  taskDateShift,
  taskDayBounds,
  taskDayStart,
} from './task-workspace-time';
import { ReminderCommand } from './dto/reminder-action.dto';
import { reminderSeriesSelect } from './reminder-repeat';

const active: Prisma.ReminderWhereInput = {
  status: { in: ['OPEN', 'SNOOZED'] },
  deletedAt: null,
};
const incoming = (id: string): Prisma.ReminderWhereInput => ({
  createdById: { not: id },
  OR: [{ isHandoff: true }, { assignedByAdmin: true }],
});
const unassigned: Prisma.ReminderWhereInput = {
  ownerKind: 'USER',
  OR: [
    { owner: { isActive: false } },
    {
      context: { not: 'PERSONAL' },
      owner: { role: { notIn: ['SALES', 'ADMIN'] } },
    },
    {
      context: 'WEBSITE_LEAD',
      websiteLead: { assignedToId: null },
      owner: { role: { not: 'ADMIN' } },
    },
  ],
};
const taskInclude = {
  series: { select: reminderSeriesSelect },
  owner: { select: { name: true, isActive: true, role: true } },
  createdBy: { select: { name: true } },
  workingBy: { select: { name: true } },
  websiteLead: {
    select: {
      customerName: true,
      customerPhone: true,
      state: true,
      partRequested: true,
      vehicleYear: true,
      vehicleMake: true,
      vehicleModel: true,
      status: true,
      assignedToId: true,
    },
  },
  lead: {
    select: {
      customerName: true,
      customerPhone: true,
      state: true,
      partDescription: true,
      vehicleYear: true,
      vehicleMake: true,
      vehicleModel: true,
      status: true,
      quote: true,
      quoteCurrency: true,
      createdById: true,
      leadDate: true,
      convertedOrderId: true,
    },
  },
  order: {
    select: {
      orderNumber: true,
      salesNumber: true,
      customerName: true,
      customerPhone: true,
      billingState: true,
      partDescription: true,
      intakeDetails: true,
      totalSaleAmount: true,
      currency: true,
      status: true,
      createdById: true,
    },
  },
  shipment: {
    select: {
      status: true,
      proNumber: true,
      bolNumber: true,
      carrierName: true,
    },
  },
  replacement: {
    select: {
      replacementStatus: true,
      replacementProNumber: true,
      replacementCarrierName: true,
    },
  },
} satisfies Prisma.ReminderInclude;
type TaskRow = Prisma.ReminderGetPayload<{ include: typeof taskInclude }>;

function recordOwnership(userId: string): Prisma.ReminderWhereInput {
  return {
    OR: [
      { context: 'PERSONAL', createdById: userId },
      { context: 'WEBSITE_LEAD', websiteLead: { assignedToId: userId } },
      { context: 'LEAD', lead: { createdById: userId } },
      { context: 'ORDER', order: { createdById: userId } },
    ],
  };
}
export function taskScope(
  user: AuthenticatedUser,
  scope = 'MINE',
): Prisma.ReminderWhereInput {
  if (['TEAM', 'UNASSIGNED'].includes(scope) && user.role !== 'ADMIN')
    throw new ForbiddenException('Only Admin can view team tasks.');
  if (scope === 'UNASSIGNED') return unassigned;
  if (scope === 'TEAM') return {};
  if (scope === 'QUEUE') {
    if (user.role === 'SALES')
      throw new ForbiddenException(
        'Use Sent handoffs to track your Shipping tasks.',
      );
    return {
      ownerKind: 'SHIPPING_QUEUE',
      context: { in: [...SHIPPING_CONTEXTS] },
    };
  }
  if (scope === 'SENT')
    return {
      AND: [
        { createdById: user.userId },
        {
          OR: [
            { isHandoff: true },
            ...(user.role === 'ADMIN' ? [{ assignedByAdmin: true }] : []),
          ],
        },
        ...(user.role === 'SALES'
          ? [{ order: { createdById: user.userId } }]
          : []),
      ],
    };
  if (user.role === 'SHIPPING')
    return {
      OR: [
        {
          ownerKind: 'SHIPPING_QUEUE',
          context: { in: [...SHIPPING_CONTEXTS] },
        },
        {
          context: 'PERSONAL',
          ownerUserId: user.userId,
          createdById: user.userId,
        },
      ],
    };
  if (user.role === 'ADMIN')
    return {
      OR: [{ ownerUserId: user.userId }, { escalatedAt: { not: null } }],
    };
  return {
    AND: [
      { ownerKind: 'USER', ownerUserId: user.userId },
      recordOwnership(user.userId),
    ],
  };
}

@Injectable()
export class TaskWorkspaceService {
  constructor(
    private readonly repository: RemindersRepository,
    private readonly core: RemindersService,
    private readonly queries: ReminderQueriesService,
    private readonly actions: ReminderActionsService,
  ) {}

  private async preferences(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    zone?: string,
  ) {
    await this.core.assertActiveActor(tx, user);
    const pref = await tx.reminderUserPreference.findUnique({
      where: { userId: user.userId },
    });
    return {
      zone:
        zone ??
        pref?.displayTimeZone ??
        (await readReminderPolicy(tx)).defaultDisplayTimeZone,
      seenAt: pref?.handoffsSeenAt ?? new Date(0),
    };
  }
  private async counts(
    tx: Prisma.TransactionClient,
    scope: Prisma.ReminderWhereInput,
    user: AuthenticatedUser,
    zone: string,
    seen: Date,
    now: Date,
  ) {
    const bounds = taskDayBounds(now, zone);
    const count = (where: Prisma.ReminderWhereInput) =>
      tx.reminder.count({ where: { AND: [scope, active, where] } });
    const [
      all,
      overdue,
      today,
      upcoming,
      handed,
      newHandoffs,
      done,
      cancelled,
      badge,
      working,
    ] = await Promise.all([
      count({}),
      count({ dueAt: { lt: now } }),
      count({ dueAt: { gte: bounds.start, lt: bounds.end } }),
      count({ dueAt: { gte: bounds.end, lt: bounds.nextEnd } }),
      count(incoming(user.userId)),
      count({ AND: [incoming(user.userId), { createdAt: { gt: seen } }] }),
      tx.reminder.count({
        where: { AND: [scope, { deletedAt: null, status: 'COMPLETED' }] },
      }),
      tx.reminder.count({
        where: { AND: [scope, { deletedAt: null, status: 'CANCELLED' }] },
      }),
      count({ dueAt: { lt: bounds.end } }),
      count({ workingById: user.userId, workingUntil: { gt: now } }),
    ]);
    return {
      all,
      overdue,
      today,
      upcoming,
      handed,
      newHandoffs,
      done,
      cancelled,
      badge,
      working,
    };
  }
  summary(user: AuthenticatedUser, now = new Date()) {
    return this.repository.transaction(async (tx) => {
      const pref = await this.preferences(tx, user);
      return {
        ...(await this.counts(
          tx,
          taskScope(user),
          user,
          pref.zone,
          pref.seenAt,
          now,
        )),
        displayTimeZone: pref.zone,
        asOf: now.toISOString(),
      };
    });
  }
  async seen(user: AuthenticatedUser, seenThrough: string, now = new Date()) {
    const seenAt = new Date(seenThrough);
    if (!Number.isFinite(seenAt.getTime()) || seenAt > now)
      throw new BadRequestException(
        'The acknowledgement cannot be in the future.',
      );
    return this.repository.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      const existing = await tx.reminderUserPreference.findUnique({
        where: { userId: user.userId },
      });
      if (!existing?.handoffsSeenAt || existing.handoffsSeenAt < seenAt)
        await tx.reminderUserPreference.upsert({
          where: { userId: user.userId },
          create: {
            userId: user.userId,
            handoffsSeenAt: seenAt,
            displayTimeZone: (await readReminderPolicy(tx))
              .defaultDisplayTimeZone,
          },
          update: { handoffsSeenAt: seenAt },
        });
      return {
        seenThrough: (existing?.handoffsSeenAt &&
        existing.handoffsSeenAt > seenAt
          ? existing.handoffsSeenAt
          : seenAt
        ).toISOString(),
      };
    });
  }
  list(
    q: QueryTaskWorkspaceDto,
    user: AuthenticatedUser,
    now = new Date(),
    exporting = false,
  ) {
    return this.repository.transaction(async (tx) => {
      const { zone, seenAt } = await this.preferences(
        tx,
        user,
        q.displayTimeZone,
      );
      const scope = taskScope(user, q.scope);
      if (q.ownerId && user.role !== 'ADMIN')
        throw new ForbiddenException('Only Admin can filter by another owner.');
      const bounds = taskDayBounds(now, zone);
      const filters: Prisma.ReminderWhereInput[] = [scope, { deletedAt: null }];
      if (q.ownerId) filters.push({ ownerUserId: q.ownerId });
      if (q.context) filters.push({ context: q.context });
      if (q.typeKey) filters.push({ typeKey: q.typeKey });
      if (q.priority) filters.push({ priority: q.priority });
      if (q.handoff) filters.push({ isHandoff: true });
      if (q.flagged) {
        if (user.role !== 'ADMIN')
          throw new ForbiddenException(
            'Only Admin can view repeated-snooze flags.',
          );
        const settings = await tx.reminderSettings.findUnique({
          where: { id: 'default' },
        });
        filters.push(
          settings?.snoozeFlagCount
            ? { snoozeCount: { gte: settings.snoozeFlagCount } }
            : { id: { in: [] } },
        );
      }
      if (q.working)
        filters.push({ workingById: user.userId, workingUntil: { gt: now } });
      const highlightFilters = [...filters];
      if (q.tab === 'DONE') filters.push({ status: 'COMPLETED' });
      else if (q.tab === 'CANCELLED') filters.push({ status: 'CANCELLED' });
      else if (!q.status) filters.push(active);
      if (q.status === 'OPEN')
        filters.push({
          OR: [
            { status: 'OPEN' },
            { status: 'SNOOZED', snoozedUntil: { lte: now } },
          ],
        });
      else if (q.status === 'SNOOZED')
        filters.push({ status: 'SNOOZED', snoozedUntil: { gt: now } });
      else if (q.status) filters.push({ status: q.status });
      if (q.tab === 'OVERDUE') filters.push(active, { dueAt: { lt: now } });
      if (q.tab === 'TODAY')
        filters.push({ dueAt: { gte: bounds.start, lt: bounds.end } });
      if (q.tab === 'UPCOMING')
        filters.push({ dueAt: { gte: bounds.end, lt: bounds.nextEnd } });
      if (q.tab === 'HANDED' || q.tab === 'NEW')
        filters.push(incoming(user.userId));
      if (q.tab === 'NEW') filters.push({ createdAt: { gt: seenAt } });
      if (q.calendar && (!q.from || !q.to))
        throw new BadRequestException('Choose a calendar date range.');
      if (q.from || q.to) {
        if (!q.from || !q.to)
          throw new BadRequestException('Provide both date range boundaries.');
        const start = taskDayStart(q.from, zone),
          end = taskDayStart(taskDateShift(q.to, 1), zone);
        if (end <= start || end.getTime() - start.getTime() > 63 * 86400000)
          throw new BadRequestException(
            'Choose a date range of at most 62 days.',
          );
        filters.push({ dueAt: { gte: start, lt: end } });
      }
      const search = q.search?.trim();
      if (search) {
        const match = { contains: search, mode: 'insensitive' as const };
        const phone = search.replace(/\D/g, '');
        const phones =
          phone.length === 10
            ? [
                phone,
                `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`,
              ]
            : [search];
        const contact =
          user.role === 'SHIPPING'
            ? []
            : phones.flatMap((value) => [
                { lead: { customerPhone: { contains: value } } },
                { websiteLead: { customerPhone: { contains: value } } },
                { order: { customerPhone: { contains: value } } },
              ]);
        filters.push({
          OR: [
            { title: match },
            { lead: { customerName: match } },
            { websiteLead: { customerName: match } },
            {
              order: {
                OR: [
                  { orderNumber: match },
                  { salesNumber: match },
                  { customerName: match },
                ],
              },
            },
            { shipment: { OR: [{ proNumber: match }, { bolNumber: match }] } },
            ...contact,
          ],
        });
      }
      if (search) highlightFilters.push(filters[filters.length - 1]);
      const where: Prisma.ReminderWhereInput = { AND: filters };
      const highlights =
        q.highlights && !exporting
          ? await Promise.all([
              tx.reminder.findMany({
                where: {
                  AND: [...highlightFilters, active, { dueAt: { gte: now } }],
                },
                include: taskInclude,
                orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
                take: 4,
              }),
              tx.reminder.count({
                where: {
                  AND: [...highlightFilters, active, { dueAt: { lt: now } }],
                },
              }),
            ])
          : undefined;
      const limit = exporting
          ? 5001
          : Math.min(q.limit ?? 20, q.calendar ? 500 : 50),
        page = q.page ?? 1;
      const [rows, total, counts, types, owners, dayGroups] = await Promise.all(
        [
          tx.reminder.findMany({
            where,
            include: taskInclude,
            orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
          }),
          tx.reminder.count({ where }),
          this.counts(
            tx,
            {
              AND: [scope, ...(q.ownerId ? [{ ownerUserId: q.ownerId }] : [])],
            },
            user,
            zone,
            seenAt,
            now,
          ),
          tx.reminderType.findMany({
            where: { isActive: true, allowedRoles: { has: user.role } },
            select: { key: true, label: true },
            orderBy: { label: 'asc' },
          }),
          user.role === 'ADMIN'
            ? tx.user.findMany({
                select: { id: true, name: true, role: true, isActive: true },
                orderBy: { name: 'asc' },
              })
            : Promise.resolve([]),
          q.calendar
            ? tx.reminder.groupBy({
                by: ['dueAt'],
                where,
                _count: { _all: true },
                orderBy: { dueAt: 'asc' },
                take: 5001,
              })
            : Promise.resolve([]),
        ],
      );
      if (dayGroups.length > 5000)
        throw new BadRequestException(
          'This calendar range contains too many times. Narrow the range or owner filter.',
        );
      const dayCounts: Record<string, number> = {};
      for (const group of dayGroups) {
        const day = localParts(group.dueAt, zone).slice(0, 10);
        dayCounts[day] = (dayCounts[day] ?? 0) + group._count._all;
      }
      return {
        items: rows.map((row) => this.present(row, user, zone, now)),
        total,
        page,
        limit,
        counts,
        types,
        owners,
        dayCounts,
        ...(highlights
          ? {
              highlights: {
                upcoming: highlights[0].map((row) =>
                  this.present(row, user, zone, now),
                ),
                overdue: highlights[1],
              },
            }
          : {}),
        policy: await readReminderPolicy(tx),
        displayTimeZone: zone,
        asOf: now.toISOString(),
      };
    });
  }
  private present(
    row: TaskRow,
    user: AuthenticatedUser,
    zone: string,
    now: Date,
  ) {
    const { lead, websiteLead, order, shipment, replacement, ...base } = row;
    const record = websiteLead ?? lead ?? order;
    const ownerId =
      websiteLead?.assignedToId ?? lead?.createdById ?? order?.createdById;
    const statusOnly = isReminderStatusOnly(user, row);
    const closed = Boolean(
      lead?.convertedOrderId ||
      (websiteLead && ['CLOSED', 'CONVERTED'].includes(websiteLead.status)) ||
      (order && ['CANCELLED', 'REFUNDED'].includes(order.status)) ||
      shipment?.status === 'CANCELLED' ||
      replacement?.replacementStatus === 'DELIVERED',
    );
    const presented = this.queries.present(
      base,
      user,
      ownerId ?? undefined,
      now,
      closed,
    );
    const intake =
      order?.intakeDetails &&
      typeof order.intakeDetails === 'object' &&
      !Array.isArray(order.intakeDetails)
        ? order.intakeDetails
        : {};
    let href: string | null = null;
    if (row.context === 'WEBSITE_LEAD')
      href = `/website-leads/${row.websiteLeadId}`;
    if (row.context === 'LEAD')
      href = lead?.convertedOrderId
        ? `/orders/${lead.convertedOrderId}`
        : `/leads/${row.leadId}`;
    if (row.context === 'ORDER')
      href =
        user.role === 'SHIPPING'
          ? row.shipmentId
            ? `/shipments/${row.shipmentId}`
            : `/shipments/create/${row.orderId}`
          : `/orders/${row.orderId}`;
    if (row.context === 'SHIPMENT_ORDER')
      href =
        user.role === 'SALES'
          ? `/orders/${row.orderId}`
          : `/shipments/create/${row.orderId}`;
    if (row.context === 'SHIPMENT')
      href =
        user.role === 'SALES'
          ? `/orders/${row.orderId}`
          : `/shipments/${row.shipmentId}`;
    if (row.context === 'REPLACEMENT')
      href = `/replacement-orders/${row.replacementId}`;
    const privateDetails = user.role === 'SHIPPING' || statusOnly;
    const summary = {
      id:
        row.context === 'PERSONAL'
          ? null
          : row.context === 'WEBSITE_LEAD'
            ? row.websiteLeadId
            : row.context === 'LEAD'
              ? row.leadId
              : row.context === 'SHIPMENT'
                ? row.shipmentId
                : row.context === 'REPLACEMENT'
                  ? row.replacementId
                  : row.orderId,
      href: href ? `${href}#reminders` : null,
      customerName: record?.customerName ?? 'Personal task',
      reference:
        order?.salesNumber ||
        order?.orderNumber ||
        (lead
          ? `Lead · ${lead.leadDate.toISOString().slice(0, 10)}`
          : websiteLead
            ? 'Website inquiry'
            : 'Personal'),
      orderNumber: order?.orderNumber ?? null,
      phone: privateDetails ? null : (record?.customerPhone ?? null),
      state: websiteLead?.state ?? lead?.state ?? order?.billingState ?? null,
      part:
        websiteLead?.partRequested ??
        lead?.partDescription ??
        order?.partDescription ??
        null,
      vehicle: websiteLead
        ? [
            websiteLead.vehicleYear,
            websiteLead.vehicleMake,
            websiteLead.vehicleModel,
          ]
            .filter(Boolean)
            .join(' ')
        : lead
          ? [lead.vehicleYear, lead.vehicleMake, lead.vehicleModel]
              .filter(Boolean)
              .join(' ')
          : [intake.vehicleYear, intake.vehicleMake, intake.vehicleModel]
              .filter((value) => typeof value === 'string')
              .join(' '),
      amount: privateDetails
        ? null
        : (lead?.quote?.toString() ??
          order?.totalSaleAmount?.toString() ??
          null),
      currency: lead?.quoteCurrency ?? order?.currency ?? 'USD',
      status:
        replacement?.replacementStatus ??
        shipment?.status ??
        record?.status ??
        null,
      carrier:
        replacement?.replacementCarrierName ?? shipment?.carrierName ?? null,
      tracking:
        replacement?.replacementProNumber ??
        shipment?.proNumber ??
        shipment?.bolNumber ??
        null,
    };
    return {
      ...presented,
      ...(statusOnly
        ? {
            note: null,
            completionNote: null,
            actions: {
              edit: false,
              complete: false,
              snooze: false,
              delete: false,
              work: false,
            },
          }
        : {}),
      needsAdmin: Boolean(
        (row.context === 'PERSONAL'
          ? !row.owner?.isActive
          : presented.needsAdmin) ||
        (row.context === 'WEBSITE_LEAD' &&
          !websiteLead?.assignedToId &&
          row.owner?.role !== 'ADMIN'),
      ),
      record: summary,
      displayDay: localParts(row.dueAt, zone).slice(0, 10),
      received:
        row.createdById !== user.userId &&
        (row.isHandoff || row.assignedByAdmin),
      statusOnly,
    };
  }
  records(q: QueryTaskRecordsDto, user: AuthenticatedUser) {
    return this.repository.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      if (q.context === 'PERSONAL') return [];
      const shipping = SHIPPING_CONTEXTS.includes(q.context);
      if (
        (user.role === 'SALES' && shipping) ||
        (user.role === 'SHIPPING' && !shipping)
      )
        throw new ForbiddenException(
          'This record type is outside your workspace.',
        );
      const search = q.search?.trim() ?? '';
      const match = { contains: search, mode: 'insensitive' as const };
      const orderWhere: Prisma.OrderWhereInput = {
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
        ...(user.role === 'SALES' ? { createdById: user.userId } : {}),
      };
      const results: Array<{ id: string; label: string; timeZone: string }> =
        [];
      if (q.context === 'LEAD') {
        const rows = await tx.lead.findMany({
          where: {
            convertedOrderId: null,
            ...(user.role === 'SALES' ? { createdById: user.userId } : {}),
            OR: [
              { customerName: match },
              { customerPhone: match },
              { partDescription: match },
            ],
          },
          select: {
            id: true,
            customerName: true,
            state: true,
            partDescription: true,
          },
          take: 30,
          orderBy: { updatedAt: 'desc' },
        });
        results.push(
          ...rows.map((r) => ({
            id: r.id,
            label: `${r.customerName} · ${r.partDescription}`,
            timeZone: customerTimeZone(r.state),
          })),
        );
      } else if (q.context === 'WEBSITE_LEAD') {
        const rows = await tx.websiteLead.findMany({
          where: {
            status: { notIn: ['CLOSED', 'CONVERTED'] },
            ...(user.role === 'SALES' ? { assignedToId: user.userId } : {}),
            OR: [
              { customerName: match },
              { customerPhone: match },
              { partRequested: match },
            ],
          },
          select: {
            id: true,
            customerName: true,
            state: true,
            partRequested: true,
          },
          take: 30,
          orderBy: { submittedAt: 'desc' },
        });
        results.push(
          ...rows.map((r) => ({
            id: r.id,
            label: `${r.customerName ?? 'Website inquiry'} · ${r.partRequested ?? ''}`,
            timeZone: customerTimeZone(r.state),
          })),
        );
      } else if (q.context === 'ORDER' || q.context === 'SHIPMENT_ORDER') {
        const rows = await tx.order.findMany({
          where: {
            ...orderWhere,
            OR: [
              { orderNumber: match },
              { salesNumber: match },
              { customerName: match },
            ],
          },
          select: {
            id: true,
            orderNumber: true,
            salesNumber: true,
            customerName: true,
            billingState: true,
          },
          take: 30,
          orderBy: { createdAt: 'desc' },
        });
        results.push(
          ...rows.map((r) => ({
            id: r.id,
            label: `${r.salesNumber || r.orderNumber} · ${r.customerName}`,
            timeZone: customerTimeZone(r.billingState),
          })),
        );
      } else if (q.context === 'SHIPMENT') {
        const rows = await tx.shipment.findMany({
          where: {
            status: { not: 'CANCELLED' },
            order: orderWhere,
            OR: [
              { proNumber: match },
              { bolNumber: match },
              {
                order: {
                  OR: [
                    { orderNumber: match },
                    { salesNumber: match },
                    { customerName: match },
                  ],
                },
              },
            ],
          },
          select: {
            id: true,
            order: {
              select: {
                orderNumber: true,
                salesNumber: true,
                customerName: true,
                billingState: true,
              },
            },
          },
          take: 30,
          orderBy: { createdAt: 'desc' },
        });
        results.push(
          ...rows.map((r) => ({
            id: r.id,
            label: `${r.order.salesNumber || r.order.orderNumber} · ${r.order.customerName}`,
            timeZone: customerTimeZone(r.order.billingState),
          })),
        );
      } else if (q.context === 'REPLACEMENT') {
        const rows = await tx.replacementRequest.findMany({
          where: {
            replacementStatus: { not: 'DELIVERED' },
            order: orderWhere,
            orderId: undefined,
            OR: [
              {
                order: {
                  OR: [
                    { orderNumber: match },
                    { salesNumber: match },
                    { customerName: match },
                  ],
                },
              },
            ],
          },
          select: {
            id: true,
            order: {
              select: {
                orderNumber: true,
                salesNumber: true,
                customerName: true,
                billingState: true,
              },
            },
          },
          take: 30,
          orderBy: { createdAt: 'desc' },
        });
        results.push(
          ...rows.map((r) => ({
            id: r.id,
            label: `${r.order.salesNumber || r.order.orderNumber} · ${r.order.customerName}`,
            timeZone: customerTimeZone(r.order.billingState),
          })),
        );
      }
      return results;
    });
  }
  async reschedule(
    id: string,
    version: number,
    dueAt: string,
    user: AuthenticatedUser,
    now = new Date(),
  ) {
    const instant = new Date(dueAt);
    if (!Number.isFinite(instant.getTime()) || instant <= now)
      throw new BadRequestException('Choose a future due time.');
    const row = await this.repository.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      const reminder = await this.repository.find(tx, id);
      const record = await this.core.authorize(tx, reminder, user, 'edit');
      return {
        zone:
          reminder.context === 'PERSONAL' ? reminder.timeZone : record.timeZone,
      };
    });
    const local = localParts(instant, row.zone);
    const localAsUtc = new Date(`${local}:00Z`).getTime();
    const truncated = new Date(instant);
    truncated.setUTCSeconds(0, 0);
    const offset = Math.round((localAsUtc - truncated.getTime()) / 60000);
    return this.actions.mutate(
      id,
      {
        action: ReminderCommand.EDIT,
        version,
        localDueAt: local,
        utcOffsetMinutes: offset,
      },
      user,
      now,
    );
  }
  async followUps(
    q: QueryTaskWorkspaceDto,
    user: AuthenticatedUser,
    now = new Date(),
  ) {
    if (user.role !== 'ADMIN')
      throw new ForbiddenException('Follow-ups are available only to Admin.');
    return this.repository.transaction(async (tx) => {
      const { zone } = await this.preferences(tx, user, q.displayTimeZone);
      const filters: Prisma.ReminderWhereInput[] = [active];
      if (q.from || q.to) {
        if (!q.from || !q.to)
          throw new BadRequestException('Provide both report dates.');
        const start = taskDayStart(q.from, zone),
          end = taskDayStart(taskDateShift(q.to, 1), zone);
        if (end <= start || end.getTime() - start.getTime() > 367 * 86400000)
          throw new BadRequestException(
            'Choose a report range of at most one year.',
          );
        filters.push({ dueAt: { gte: start, lt: end } });
      }
      const where: Prisma.ReminderWhereInput = { AND: filters };
      const settings = await tx.reminderSettings.findUnique({
        where: { id: 'default' },
      });
      const threshold = settings?.snoozeFlagCount;
      const [users, groups, overdue, flagged, unassignedCount, handoffs] =
        await Promise.all([
          tx.user.findMany({
            where: { role: { in: ['ADMIN', 'SALES'] } },
            select: { id: true, name: true, isActive: true },
            orderBy: { name: 'asc' },
          }),
          tx.reminder.groupBy({
            by: ['ownerKind', 'ownerUserId'],
            where,
            _count: { _all: true },
          }),
          tx.reminder.groupBy({
            by: ['ownerKind', 'ownerUserId'],
            where: { AND: [where, { dueAt: { lt: now } }] },
            _count: { _all: true },
            _min: { dueAt: true },
          }),
          threshold
            ? tx.reminder.count({
                where: { AND: [where, { snoozeCount: { gte: threshold } }] },
              })
            : Promise.resolve(0),
          tx.reminder.count({ where: { AND: [where, unassigned] } }),
          tx.reminder.groupBy({
            by: ['ownerKind'],
            where: { AND: [where, { isHandoff: true }] },
            _count: { _all: true },
          }),
        ]);
      const rows = [
        ...users.map((u) => ({ id: u.id, name: u.name, isActive: u.isActive })),
        { id: 'QUEUE', name: 'Shipping queue', isActive: true },
      ].map((u) => {
        const matches = (r: {
          ownerKind: string;
          ownerUserId: string | null;
        }) =>
          u.id === 'QUEUE'
            ? r.ownerKind === 'SHIPPING_QUEUE'
            : r.ownerUserId === u.id;
        const late = overdue.find(matches);
        return {
          ...u,
          open: groups
            .filter(matches)
            .reduce((sum, r) => sum + r._count._all, 0),
          overdue: late?._count._all ?? 0,
          oldest: late?._min.dueAt?.toISOString() ?? null,
        };
      });
      return {
        rows,
        flagged,
        unassigned: unassignedCount,
        handoffsToShipping:
          handoffs.find((r) => r.ownerKind === 'SHIPPING_QUEUE')?._count._all ??
          0,
        handoffsToSales:
          handoffs.find((r) => r.ownerKind === 'USER')?._count._all ?? 0,
        displayTimeZone: zone,
        asOf: now.toISOString(),
      };
    });
  }
}
