import { readReminderPolicy } from './reminder-policy-settings';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Reminder } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { QueryRecordRemindersDto } from './dto/query-record-reminders.dto';
import {
  assertReminderAccess,
  isReminderStatusOnly,
  SHIPPING_CONTEXTS,
} from './reminder-policy';
import { resolveReminderRecord } from './reminder-record';
import { reminderRecordId } from './reminder-lifecycle';
import { DEFAULT_REMINDER_TIME_ZONE } from './reminder-time';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';
import { listReminderSuggestions } from './reminder-suggestions';
import { reminderSeriesSelect } from './reminder-repeat';

const include = {
  series: { select: reminderSeriesSelect },
  owner: { select: { name: true, isActive: true, role: true } },
  createdBy: { select: { name: true } },
  workingBy: { select: { name: true } },
} as const;
@Injectable()
export class ReminderQueriesService {
  constructor(
    private readonly repository: RemindersRepository,
    private readonly core: RemindersService,
  ) {}
  record(
    query: QueryRecordRemindersDto,
    user: AuthenticatedUser,
    now = new Date(),
  ) {
    return this.repository.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      const record = await resolveReminderRecord(
        tx,
        query.context,
        query.recordId,
      );
      const shipping = SHIPPING_CONTEXTS.includes(query.context);
      if (
        user.role === Role.SALES &&
        (shipping ||
          (query.context !== 'PERSONAL' && record.owner?.id !== user.userId))
      )
        throw new ForbiddenException(
          'Reminders are available only on your own Sales records.',
        );
      if (
        user.role === Role.SHIPPING &&
        !shipping &&
        query.context !== 'PERSONAL'
      )
        throw new ForbiddenException(
          'Use the Shipping workspace for reminders.',
        );
      let scope: Prisma.ReminderWhereInput;
      if (query.context === 'PERSONAL')
        scope = { context: 'PERSONAL', ownerUserId: user.userId };
      else if (query.context === 'ORDER')
        scope = {
          orderId: query.recordId,
          OR: [{ context: 'ORDER' }, { ownerKind: 'SHIPPING_QUEUE' }],
        };
      else if (query.context === 'SHIPMENT_ORDER')
        scope = {
          orderId: query.recordId,
          OR: [
            { context: { in: ['SHIPMENT_ORDER', 'SHIPMENT'] } },
            { isHandoff: true, context: 'ORDER', replacementId: null },
          ],
        };
      else if (query.context === 'SHIPMENT')
        scope = {
          orderId: record.links.orderId,
          OR: [
            { context: 'SHIPMENT_ORDER' },
            { shipmentId: query.recordId, replacementId: null },
          ],
        };
      else
        scope = {
          [query.context === 'WEBSITE_LEAD'
            ? 'websiteLeadId'
            : query.context === 'LEAD'
              ? 'leadId'
              : 'replacementId']: query.recordId,
        };
      const source: Prisma.ReminderWhereInput = {
        originContext: query.context,
        originRecordId: query.recordId,
      };
      const acl: Prisma.ReminderWhereInput =
        user.role === Role.ADMIN
          ? {}
          : user.role === Role.SALES
            ? {
                OR: [
                  { ownerKind: 'USER', ownerUserId: user.userId },
                  { isHandoff: true, createdById: user.userId },
                  ...(query.context === 'ORDER'
                    ? [
                        {
                          ownerKind: 'SHIPPING_QUEUE' as const,
                          orderId: query.recordId,
                        },
                      ]
                    : []),
                ],
              }
            : {
                OR: [
                  { ownerKind: 'SHIPPING_QUEUE' },
                  { context: 'PERSONAL', ownerUserId: user.userId },
                  { isHandoff: true, createdById: user.userId },
                ],
              };
      // Record panels have bounded pages; counts and history use the same scoped permissions.
      const current: Prisma.ReminderWhereInput = {
        AND: [
          scope,
          acl,
          { deletedAt: null, status: { in: ['OPEN', 'SNOOZED'] } },
        ],
      };
      const historical: Prisma.ReminderWhereInput = {
        AND: [
          acl,
          {
            OR: [
              {
                AND: [
                  scope,
                  {
                    OR: [
                      { status: { in: ['COMPLETED', 'CANCELLED'] } },
                      { deletedAt: { not: null } },
                    ],
                  },
                ],
              },
              { AND: [source, { NOT: { context: query.context } }] },
            ],
          },
        ],
      };
      const where = query.history ? historical : current;
      const [
        rows,
        total,
        openCount,
        overdueCount,
        types,
        preference,
        completedShipping,
      ] = await Promise.all([
        tx.reminder.findMany({
          where,
          include,
          orderBy: query.history
            ? [{ updatedAt: 'desc' }, { id: 'asc' }]
            : [{ dueAt: 'asc' }, { id: 'asc' }],
          skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
          take: query.limit ?? 20,
        }),
        tx.reminder.count({ where }),
        tx.reminder.count({ where: current }),
        tx.reminder.count({
          where: { AND: [current, { dueAt: { lt: now } }] },
        }),
        tx.reminderType.findMany({
          where: { isActive: true, allowedRoles: { has: user.role } },
          orderBy: { label: 'asc' },
          select: { key: true, label: true },
        }),
        tx.reminderUserPreference.findUnique({
          where: { userId: user.userId },
        }),
        query.context === 'ORDER' && user.role === Role.SALES
          ? tx.reminder.findMany({
              where: {
                orderId: query.recordId,
                ownerKind: 'SHIPPING_QUEUE',
                status: 'COMPLETED',
                deletedAt: null,
              },
              include,
              orderBy: { updatedAt: 'desc' },
              take: 5,
            })
          : Promise.resolve([]),
      ]);
      const items = [] as Array<ReturnType<typeof this.present>>;
      const recordCache = new Map([
        [`${query.context}:${query.recordId ?? ''}`, record],
      ]);
      for (const row of rows) {
        try {
          const key = `${row.context}:${reminderRecordId(row) ?? ''}`;
          const currentRecord =
            recordCache.get(key) ??
            (await resolveReminderRecord(
              tx,
              row.context,
              reminderRecordId(row) ?? undefined,
            ));
          recordCache.set(key, currentRecord);
          assertReminderAccess(user, row, 'read', currentRecord.owner?.id);
          items.push(
            this.present(
              row,
              user,
              currentRecord.owner?.id,
              now,
              query.history,
            ),
          );
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      }
      const assignments =
        query.context === 'PERSONAL'
          ? ['SELF']
          : user.role === Role.ADMIN
            ? [
                'SELF',
                ...(shipping || record.owner?.isActive ? ['RECORD_OWNER'] : []),
                ...(query.context === 'ORDER' ? ['SHIPPING_QUEUE'] : []),
                ...(shipping && record.owner?.isActive ? ['SALES_AGENT'] : []),
              ]
            : shipping
              ? [
                  'RECORD_OWNER',
                  ...(record.owner?.isActive ? ['SALES_AGENT'] : []),
                ]
              : [
                  'RECORD_OWNER',
                  ...(query.context === 'ORDER' ? ['SHIPPING_QUEUE'] : []),
                ];
      return {
        shippingDone: completedShipping.map((row) =>
          this.present(row, user, record.owner?.id, now, true),
        ),
        items,
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        openCount,
        overdueCount,
        types,
        assignments,
        timeZone: record.timeZone,
        displayTimeZone:
          preference?.displayTimeZone ??
          (await readReminderPolicy(tx)).defaultDisplayTimeZone,
        policy: await readReminderPolicy(tx),
        canCreate: !record.closed,
        recordClosed: record.closed,
        suggestions:
          query.context === 'PERSONAL' || !query.recordId || query.history
            ? []
            : await listReminderSuggestions(
                tx,
                query.context,
                query.recordId,
                user,
                now,
              ),
      };
    });
  }
  history(id: string, user: AuthenticatedUser) {
    return this.repository.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      // Soft-deleted reminders retain their audit history and the same access policy.
      const row = await tx.reminder.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Reminder was not found.');
      await this.core.authorize(tx, row, user, 'read');
      const history = await tx.reminderHistory.findMany({
        where: { reminderId: id },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return isReminderStatusOnly(user, row)
        ? history.map((entry) => ({ ...entry, changes: null }))
        : history;
    });
  }
  present(
    row: Reminder & {
      owner: { name: string; isActive: boolean; role: string } | null;
      createdBy: { name: string };
      workingBy: { name: string } | null;
    },
    user: AuthenticatedUser,
    recordOwnerId: string | undefined,
    now: Date,
    history?: boolean,
  ) {
    const actions = Object.fromEntries(
      (['edit', 'complete', 'snooze', 'delete', 'work'] as const).map(
        (action) => {
          try {
            assertReminderAccess(user, row, action, recordOwnerId);
            return [
              action,
              !history &&
                ['OPEN', 'SNOOZED'].includes(row.status) &&
                (action !== 'work' || row.ownerKind === 'SHIPPING_QUEUE'),
            ];
          } catch {
            return [action, false];
          }
        },
      ),
    );
    const activeMarker = Boolean(row.workingUntil && row.workingUntil > now);
    return {
      ...row,
      ...(isReminderStatusOnly(user, row)
        ? { note: null, completionNote: null }
        : {}),
      status:
        row.status === 'SNOOZED' && row.snoozedUntil && row.snoozedUntil <= now
          ? 'OPEN'
          : row.status,
      workingBy: activeMarker ? row.workingBy : null,
      workingById: activeMarker ? row.workingById : null,
      workingUntil: activeMarker ? row.workingUntil : null,
      overdue: ['OPEN', 'SNOOZED'].includes(row.status) && row.dueAt < now,
      needsAdmin:
        row.owner &&
        (!row.owner.isActive || !['SALES', 'ADMIN'].includes(row.owner.role)),
      actions,
    };
  }
}
