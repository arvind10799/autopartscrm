import { readReminderPolicy } from './reminder-policy-settings';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  Reminder,
  ReminderDelivery,
  ReminderDeliveryKind,
  User,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';
import {
  defaultShift,
  nextShift,
  shiftDay,
  withinShift,
} from './reminder-delivery-time';
import { localParts } from './reminder-time';
import { taskDateShift, taskDayStart } from './task-workspace-time';
import { taskScope } from './task-workspace.service';
import { isReminderStatusOnly } from './reminder-policy';
import {
  ReminderTransportService,
  ReminderMessage,
} from './reminder-transport.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Role } from '../../common/enums/role.enum';

const open = (r: Reminder) =>
  !r.deletedAt && ['OPEN', 'SNOOZED'].includes(r.status);
const timed = ['EARLY', 'DUE', 'SECOND_ALERT', 'ESCALATION'];
const actor = (u: User): AuthenticatedUser => ({
  userId: u.id,
  name: u.name,
  email: u.email,
  role: u.role as Role,
});
export function alertStage(
  row: Pick<Reminder, 'dueAt' | 'earlyAlertMinutes'> &
    Partial<Pick<Reminder, 'status' | 'snoozedUntil'>>,
  now: Date,
  second: number | null,
): ReminderDeliveryKind | null {
  if (row.status === 'SNOOZED' && row.snoozedUntil && row.snoozedUntil > now)
    return null;
  const minutes = (now.getTime() - row.dueAt.getTime()) / 60000;
  if (minutes >= 0)
    return second !== null && minutes >= second ? 'SECOND_ALERT' : 'DUE';
  return row.earlyAlertMinutes > 0 && minutes >= -row.earlyAlertMinutes
    ? 'EARLY'
    : null;
}
@Injectable()
export class ReminderDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderDeliveryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopping = false;
  private cursor?: { dueAt: Date; id: string };
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: RemindersRepository,
    private readonly core: RemindersService,
    private readonly transport: ReminderTransportService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (this.config.get('REMINDERS_DELIVERY_ENABLED') !== 'true') return;
    const run = () => {
      if (!this.running && !this.stopping)
        this.running = this.tick()
          .catch(() =>
            this.logger.error(
              'Reminder batch failed; durable work remains available for retry.',
            ),
          )
          .finally(() => {
            this.running = undefined;
          });
    };
    this.timer = setInterval(run, 5000);
    this.timer.unref();
    run();
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  private async enabled() {
    return (
      this.config.get('REMINDERS_DELIVERY_ENABLED') === 'true' &&
      Boolean(
        (
          await this.prisma.reminderSettings.findUnique({
            where: { id: 'default' },
          })
        )?.deliveryEnabled,
      )
    );
  }
  async tick(now = new Date()) {
    if (!(await this.enabled())) return;
    await this.plan(now);
    for (let i = 0; i < 10 && !this.stopping; i++) {
      const delivery = await this.claim(now);
      if (!delivery) break;
      await this.deliver(delivery, now);
    }
    if (!this.stopping) await this.digest(now);
  }
  /** Bounded keyset sweep; reset at the end. No skipped oldest-page starvation. */
  async plan(now: Date) {
    const rows = await this.prisma.reminder.findMany({
      where: {
        status: { in: ['OPEN', 'SNOOZED'] },
        deletedAt: null,
        dueAt: { lte: new Date(now.getTime() + 30 * 60000) },
        ...(this.cursor
          ? {
              OR: [
                { dueAt: { gt: this.cursor.dueAt } },
                { dueAt: this.cursor.dueAt, id: { gt: this.cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take: 50,
      include: { owner: { select: { role: true, isActive: true } } },
    });
    const [settings, staff] = await Promise.all([
      this.prisma.reminderSettings.findUniqueOrThrow({
        where: { id: 'default' },
      }),
      this.prisma.user.findMany({
        where: { isActive: true, role: { in: ['SHIPPING', 'ADMIN'] } },
        select: { id: true, role: true },
      }),
    ]);
    if (!settings.deliveryEnabled) return;
    const shipping = staff
        .filter((u) => u.role === 'SHIPPING')
        .map((u) => u.id),
      admins = staff.filter((u) => u.role === 'ADMIN').map((u) => u.id);
    const intents: Prisma.ReminderDeliveryCreateManyInput[] = [];
    const append = (
      row: Reminder,
      kind: ReminderDeliveryKind,
      users: string[],
    ) => {
      for (const recipientUserId of users)
        for (const channel of ['BELL', 'PUSH', 'EMAIL'] as const)
          intents.push({
            reminderId: row.id,
            reminderVersion: row.scheduleVersion,
            kind,
            recipientUserId,
            channel,
            availableAt: now,
          });
    };
    for (const row of rows) {
      const stage = alertStage(
        row,
        now,
        row.owner?.role === 'ADMIN' ? null : settings.secondAlertMinutes,
      );
      if (stage) {
        let recipients =
          row.ownerKind === 'SHIPPING_QUEUE'
            ? shipping
            : row.owner?.isActive && row.ownerUserId
              ? [row.ownerUserId]
              : [];
        if (
          stage === 'SECOND_ALERT' &&
          row.ownerKind === 'SHIPPING_QUEUE' &&
          row.workingById &&
          row.workingUntil &&
          row.workingUntil > now &&
          shipping.includes(row.workingById)
        )
          recipients = [row.workingById];
        append(row, stage, recipients);
      }
      if (
        settings.escalationMinutes !== null &&
        row.dueAt.getTime() + settings.escalationMinutes * 60000 <=
          now.getTime()
      )
        append(row, 'ESCALATION', admins);
    }
    // Reads may race a task change. Each intent is versioned and re-authorized before delivery.
    for (let i = 0; i < intents.length; i += 500)
      await this.prisma.reminderDelivery.createMany({
        data: intents.slice(i, i + 500),
        skipDuplicates: true,
      });
    this.cursor =
      rows.length === 50
        ? { id: rows[rows.length - 1].id, dueAt: rows[rows.length - 1].dueAt }
        : undefined;
  }
  async claim(now: Date) {
    for (let i = 0; i < 3; i++) {
      const ready: Prisma.ReminderDeliveryWhereInput = {
        OR: [
          { status: 'PENDING', availableAt: { lte: now } },
          { status: 'PROCESSING', lockedUntil: { lte: now } },
        ],
      };
      const row = await this.prisma.reminderDelivery.findFirst({
        where: ready,
        orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      });
      if (!row) return null;
      const token = randomUUID();
      const result = await this.prisma.reminderDelivery.updateMany({
        where: { id: row.id, AND: [ready] },
        data: {
          status: 'PROCESSING',
          lockedUntil: new Date(now.getTime() + 120000),
          lockToken: token,
          attempts: { increment: 1 },
        },
      });
      if (result.count === 1)
        return { ...row, lockToken: token, attempts: row.attempts + 1 };
    }
    return null;
  }
  private fence(d: ReminderDelivery) {
    return { id: d.id, status: 'PROCESSING' as const, lockToken: d.lockToken };
  }
  private finish(d: ReminderDelivery, status: 'SENT' | 'CANCELLED', now: Date) {
    return this.prisma.reminderDelivery.updateMany({
      where: this.fence(d),
      data: {
        status,
        lockedUntil: null,
        lockToken: null,
        lastError: null,
        ...(status === 'SENT' ? { sentAt: now } : {}),
      },
    });
  }
  private async prepare(
    tx: Prisma.TransactionClient,
    d: ReminderDelivery,
    now: Date,
  ) {
    const row = await tx.reminder.findUnique({ where: { id: d.reminderId } });
    const user = await tx.user.findUnique({ where: { id: d.recipientUserId } });
    if (
      !row ||
      !user?.isActive ||
      row.deletedAt ||
      (d.kind !== 'REASSIGNED' && row.scheduleVersion !== d.reminderVersion)
    )
      return null;
    const settings = await tx.reminderSettings.findUniqueOrThrow({
      where: { id: 'default' },
    });
    if (!settings.deliveryEnabled)
      return { hold: new Date(now.getTime() + 60000) };
    if (timed.includes(d.kind)) {
      if (!open(row)) return null;
      if (d.kind === 'ESCALATION') {
        if (
          user.role !== 'ADMIN' ||
          settings.escalationMinutes === null ||
          row.dueAt.getTime() + settings.escalationMinutes * 60000 >
            now.getTime()
        )
          return null;
      } else if (
        d.kind !==
        alertStage(
          row,
          now,
          user.role === 'ADMIN' && row.ownerKind === 'USER'
            ? null
            : settings.secondAlertMinutes,
        )
      )
        return null;
      if (
        d.kind === 'SECOND_ALERT' &&
        row.ownerKind === 'USER' &&
        user.role === 'ADMIN'
      )
        return null;
      if (
        d.kind === 'SECOND_ALERT' &&
        row.ownerKind === 'SHIPPING_QUEUE' &&
        row.workingById &&
        row.workingUntil &&
        row.workingUntil > now &&
        row.workingById !== user.id
      ) {
        const marked = await tx.user.findFirst({
          where: { id: row.workingById, isActive: true, role: 'SHIPPING' },
          select: { id: true },
        });
        if (marked) return null;
      }
    }
    if (d.kind === 'ASSIGNED' && !open(row)) return null;
    if (
      d.kind === 'COMPLETED' &&
      (open(row) ||
        !row.notifyCreatorOnCompletion ||
        row.createdById !== user.id)
    )
      return null;
    if (d.kind === 'AUTO_CLOSED' && open(row)) return null;
    if (d.kind !== 'REASSIGNED') {
      try {
        await this.core.authorize(tx, row, actor(user), 'read');
      } catch {
        return null;
      }
      if (
        !['ESCALATION', 'COMPLETED'].includes(d.kind) &&
        !(row.ownerKind === 'SHIPPING_QUEUE'
          ? user.role === 'SHIPPING'
          : row.ownerUserId === user.id)
      )
        return null;
    }
    const pref = (await tx.reminderUserPreference.findUnique({
      where: { userId: user.id },
    })) ?? {
      ...defaultShift,
      displayTimeZone: (await readReminderPolicy(tx)).defaultDisplayTimeZone,
    };
    if (
      row.priority !== 'HIGH' &&
      d.kind !== 'ESCALATION' &&
      !withinShift(now, pref)
    )
      return { hold: nextShift(now, pref) };
    const statusOnly =
      isReminderStatusOnly(actor(user), row) || d.kind === 'REASSIGNED';
    const order = row.orderId
      ? await tx.order.findUnique({
          where: { id: row.orderId },
          select: { salesNumber: true, orderNumber: true, customerName: true },
        })
      : null;
    const lead = row.leadId
      ? await tx.lead.findUnique({
          where: { id: row.leadId },
          select: { customerName: true },
        })
      : null;
    const website = row.websiteLeadId
      ? await tx.websiteLead.findUnique({
          where: { id: row.websiteLeadId },
          select: { customerName: true },
        })
      : null;
    const shipment = row.shipmentId
      ? await tx.shipment.findUnique({
          where: { id: row.shipmentId },
          select: { proNumber: true, bolNumber: true },
        })
      : null;
    const label =
      d.kind === 'ASSIGNED'
        ? 'New task'
        : d.kind === 'COMPLETED'
          ? row.status === 'CANCELLED'
            ? 'Task closed'
            : 'Task completed'
          : d.kind === 'AUTO_CLOSED'
            ? 'Task closed automatically'
            : d.kind === 'ESCALATION'
              ? 'Overdue escalation'
              : d.kind === 'EARLY'
                ? 'Upcoming reminder'
                : d.kind === 'SECOND_ALERT'
                  ? 'Reminder still overdue'
                  : d.kind === 'REASSIGNED'
                    ? 'Task reassigned'
                    : 'Reminder due';
    const creator = await tx.user.findUnique({
      where: { id: row.createdById },
      select: { name: true },
    });
    const type = await tx.reminderType.findUnique({
      where: { key: row.typeKey },
      select: { label: true },
    });
    const format = (zone: string) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(row.dueAt);
    const display =
      format(row.timeZone) +
      (row.timeZone !== pref.displayTimeZone
        ? ` · ${format(pref.displayTimeZone)}`
        : '');
    const reference = [
      order?.salesNumber || order?.orderNumber,
      order?.customerName || lead?.customerName || website?.customerName,
      shipment?.proNumber || shipment?.bolNumber,
    ]
      .filter(Boolean)
      .join(' · ');
    const owner =
      d.kind === 'ESCALATION'
        ? row.ownerKind === 'SHIPPING_QUEUE'
          ? 'Shipping queue'
          : (
              await tx.user.findUnique({
                where: { id: row.ownerUserId! },
                select: { name: true },
              })
            )?.name
        : null;
    const body =
      d.kind === 'REASSIGNED'
        ? 'A task was moved following a website inquiry reassignment. Your previous access has ended.'
        : [
            row.title,
            reference,
            `${type?.label ?? row.typeKey} · ${row.priority.toLowerCase()} priority`,
            display,
            d.kind === 'ASSIGNED'
              ? `From ${creator?.name ?? 'CRM'}`
              : owner
                ? `Owner: ${owner}`
                : null,
            !statusOnly ? row.note?.slice(0, 80) : null,
          ]
            .filter(Boolean)
            .join('\n');
    const payload: ReminderMessage = {
      title: label,
      body,
      href: d.kind === 'REASSIGNED' ? '/my-tasks' : `/my-tasks?task=${row.id}`,
      reminderId: row.id,
      userId: user.id,
    };
    const entityType = d.kind === 'REASSIGNED' ? 'REMINDER' : row.context;
    const entityId =
      d.kind === 'REASSIGNED'
        ? row.id
        : row.context === 'WEBSITE_LEAD'
          ? row.websiteLeadId!
          : row.context === 'LEAD'
            ? row.leadId!
            : row.context === 'SHIPMENT'
              ? row.shipmentId!
              : row.context === 'REPLACEMENT'
                ? row.replacementId!
                : (row.orderId ?? row.id);
    return { row, user, payload, entityType, entityId };
  }
  async deliver(d: ReminderDelivery, now = new Date()) {
    try {
      const data = await this.repo.transaction(async (tx) => {
        const current = await tx.reminderDelivery.findFirst({
          where: this.fence(d),
        });
        if (!current) return null;
        const prepared = await this.prepare(tx, d, now);
        if (!prepared || 'hold' in prepared) return prepared;
        if (d.channel === 'BELL') {
          await tx.notification.upsert({
            where: { reminderDeliveryId: d.id },
            create: {
              id: d.id,
              reminderDeliveryId: d.id,
              reminderId: prepared.row.id,
              recipientUserId: prepared.user.id,
              type: `REMINDER_${d.kind}`,
              title: prepared.payload.title,
              message: prepared.payload.body,
              entityType: prepared.entityType,
              entityId: prepared.entityId,
            },
            update: {},
          });
          if (d.kind === 'ESCALATION') {
            const escalated = await tx.reminder.updateMany({
              where: {
                id: prepared.row.id,
                scheduleVersion: d.reminderVersion,
                escalatedAt: null,
              },
              data: { escalatedAt: now },
            });
            if (escalated.count)
              await tx.reminderHistory.create({
                data: {
                  reminderId: prepared.row.id,
                  action: 'ESCALATED',
                  changes: {
                    recipientUserId: d.recipientUserId,
                    scheduleVersion: d.reminderVersion,
                  },
                },
              });
          }
          await tx.reminderDelivery.updateMany({
            where: this.fence(d),
            data: {
              status: 'SENT',
              sentAt: now,
              lockedUntil: null,
              lockToken: null,
            },
          });
        }
        return prepared;
      });
      if (!data) {
        await this.finish(d, 'CANCELLED', now);
        return;
      }
      if ('hold' in data) {
        await this.prisma.reminderDelivery.updateMany({
          where: this.fence(d),
          data: {
            status: 'PENDING',
            availableAt: data.hold,
            lockedUntil: null,
            lockToken: null,
            attempts: { decrement: 1 },
          },
        });
        return;
      }
      if (d.channel === 'BELL') return;
      // Disable switch and cancellation are rechecked immediately before external I/O.
      if (!(await this.enabled())) {
        await this.prisma.reminderDelivery.updateMany({
          where: this.fence(d),
          data: {
            status: 'PENDING',
            availableAt: new Date(now.getTime() + 60000),
            lockedUntil: null,
            lockToken: null,
            attempts: { decrement: 1 },
          },
        });
        return;
      }
      if (
        !(await this.prisma.reminderDelivery.findFirst({
          where: this.fence(d),
        }))
      )
        return;
      if (d.channel === 'PUSH') {
        const sent = await this.transport.push(
          d.id,
          data.user.id,
          data.payload,
        );
        await this.finish(d, sent ? 'SENT' : 'CANCELLED', now);
      } else {
        if (!this.transport.emailConfigured()) {
          await this.finish(d, 'CANCELLED', now);
          return;
        }
        const push = await this.prisma.reminderDelivery.findUnique({
          where: {
            reminderId_reminderVersion_recipientUserId_kind_channel: {
              reminderId: d.reminderId,
              reminderVersion: d.reminderVersion,
              recipientUserId: d.recipientUserId,
              kind: d.kind,
              channel: 'PUSH',
            },
          },
        });
        if (push?.status === 'SENT') {
          await this.finish(d, 'CANCELLED', now);
          return;
        }
        if (
          push &&
          ['PENDING', 'PROCESSING'].includes(push.status) &&
          this.transport.pushConfigured()
        ) {
          await this.prisma.reminderDelivery.updateMany({
            where: this.fence(d),
            data: {
              status: 'PENDING',
              availableAt: new Date(now.getTime() + 60000),
              lockedUntil: null,
              lockToken: null,
              attempts: { decrement: 1 },
            },
          });
          return;
        }
        const url = this.appUrl(data.payload.href);
        await this.transport.email(
          data.user.email,
          data.payload.title,
          `${data.payload.body}\n\nOpen CRM: ${url}`,
          d.id,
        );
        await this.finish(d, 'SENT', now);
      }
    } catch {
      // Provider responses may include credentials or customer data. Retain only a safe category.
      await this.prisma.reminderDelivery.updateMany({
        where: this.fence(d),
        data: {
          status: d.attempts >= 6 ? 'FAILED' : 'PENDING',
          availableAt: new Date(
            now.getTime() +
              Math.min(3600000, 30000 * 2 ** Math.min(d.attempts, 6)),
          ),
          lockedUntil: null,
          lockToken: null,
          lastError: 'Delivery could not be confirmed; retry policy applied.',
        },
      });
    }
  }
  private appUrl(path: string) {
    const base =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('CRM_BASE_URL') ||
      this.config.get<string>('FRONTEND_URL');
    if (!base) throw new Error('CRM URL is not configured');
    const url = new URL(base);
    if (!['https:', 'http:'].includes(url.protocol))
      throw new Error('Invalid CRM URL');
    return new URL(path, url.origin).toString();
  }
  private digestCursor?: string;
  async digest(now: Date) {
    if (!this.transport.emailConfigured()) return;
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(this.digestCursor ? { id: { gt: this.digestCursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: 10,
      include: { reminderPreferences: true },
    });
    this.digestCursor =
      users.length === 10 ? users[users.length - 1].id : undefined;
    for (const user of users) {
      const pref = user.reminderPreferences ?? {
        ...defaultShift,
        displayTimeZone: (await readReminderPolicy(this.prisma))
          .defaultDisplayTimeZone,
        dailyDigestEnabled: true,
      };
      if (!pref.dailyDigestEnabled || !withinShift(now, pref)) continue;
      const day = shiftDay(now, pref),
        token = randomUUID();
      await this.prisma.reminderDigest.createMany({
        data: [{ userId: user.id, shiftDate: day, availableAt: now }],
        skipDuplicates: true,
      });
      const ready: Prisma.ReminderDigestWhereInput = {
        userId: user.id,
        shiftDate: day,
        OR: [
          { status: 'PENDING', availableAt: { lte: now } },
          { status: 'PROCESSING', lockedUntil: { lte: now } },
        ],
      };
      const claimed = await this.prisma.reminderDigest.updateMany({
        where: ready,
        data: {
          status: 'PROCESSING',
          lockedUntil: new Date(now.getTime() + 120000),
          lockToken: token,
          attempts: { increment: 1 },
        },
      });
      if (!claimed.count) continue;
      const fence = {
        userId: user.id,
        shiftDate: day,
        status: 'PROCESSING' as const,
        lockToken: token,
      };
      const job = await this.prisma.reminderDigest.findUniqueOrThrow({
        where: { userId_shiftDate: { userId: user.id, shiftDate: day } },
      });
      try {
        const today = localParts(now, pref.displayTimeZone).slice(0, 10),
          end = taskDayStart(taskDateShift(today, 1), pref.displayTimeZone);
        const where: Prisma.ReminderWhereInput = {
          AND: [
            taskScope(actor(user), user.role === 'ADMIN' ? 'TEAM' : 'MINE'),
            {
              status: { in: ['OPEN', 'SNOOZED'] },
              deletedAt: null,
              dueAt: { lt: end },
            },
          ],
        };
        const [rows, total] = await Promise.all([
          this.prisma.reminder.findMany({
            where,
            orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
            take: 50,
            include: { owner: { select: { name: true } } },
          }),
          this.prisma.reminder.count({ where }),
        ]);
        if (!total) {
          await this.prisma.reminderDigest.updateMany({
            where: fence,
            data: { status: 'CANCELLED', lockToken: null, lockedUntil: null },
          });
          continue;
        }
        // Staff-only summary. No record notes, contact fields, or private Shipping outcomes.
        const text = rows
          .map(
            (r) =>
              `${r.title} — ${localParts(r.dueAt, pref.displayTimeZone).replace('T', ' ')} (${pref.displayTimeZone})${user.role === 'ADMIN' ? ` · ${r.ownerKind === 'SHIPPING_QUEUE' ? 'Shipping queue' : (r.owner?.name ?? 'Inactive / unassigned')}` : ''}`,
          )
          .join('\n');
        if (!(await this.enabled())) return;
        const currentUser = await this.prisma.user.findFirst({
          where: {
            id: user.id,
            isActive: true,
            role: user.role,
            updatedAt: user.updatedAt,
          },
          include: { reminderPreferences: true },
        });
        const currentPreference = currentUser?.reminderPreferences ?? {
          ...defaultShift,
          displayTimeZone: (await readReminderPolicy(this.prisma))
            .defaultDisplayTimeZone,
          dailyDigestEnabled: true,
        };
        if (
          !currentUser ||
          !currentPreference.dailyDigestEnabled ||
          currentPreference.displayTimeZone !== pref.displayTimeZone ||
          !withinShift(now, currentPreference)
        ) {
          await this.prisma.reminderDigest.updateMany({
            where: fence,
            data: { status: 'CANCELLED', lockToken: null, lockedUntil: null },
          });
          continue;
        }
        await this.transport.email(
          user.email,
          `CRM daily tasks: ${total} overdue / due today`,
          `${text}\n\n${total > 50 ? 'Showing the first 50. ' : ''}Open CRM: ${this.appUrl('/my-tasks')}`,
          job.id,
        );
        await this.prisma.reminderDigest.updateMany({
          where: fence,
          data: {
            status: 'SENT',
            sentAt: now,
            lockToken: null,
            lockedUntil: null,
            lastError: null,
          },
        });
      } catch {
        await this.prisma.reminderDigest.updateMany({
          where: fence,
          data: {
            status: job.attempts >= 6 ? 'FAILED' : 'PENDING',
            availableAt: new Date(
              now.getTime() + 60000 * 2 ** Math.min(job.attempts, 6),
            ),
            lockedUntil: null,
            lockToken: null,
            lastError: 'Digest delivery could not be confirmed.',
          },
        });
      }
    }
  }
}
