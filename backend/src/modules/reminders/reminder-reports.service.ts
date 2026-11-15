import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { buildOrdersExportWorkbook } from '../orders/orders-export-workbook.builder';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';
import { ReminderReportDto } from './dto/reminder-report.dto';
import { readReminderPolicy } from './reminder-policy-settings';
import { localParts } from './reminder-time';
import { taskDateShift, taskDayStart } from './task-workspace-time';
import {
  actionableLeadStatuses,
  attachTableFollowUps,
  exportFollowUp,
  TableFollowUp,
} from './reminder-table';

type ReportRow = {
  id: string;
  reference: string;
  customer: string;
  owner: string;
  date: string;
  href: string;
  followUp?: TableFollowUp | null;
  completed?: number;
  onTime?: number;
  onTimePercent?: number;
  queueCount?: number;
  queueDelayMinutes?: number | null;
  type?: string;
};
@Injectable()
export class ReminderReportsService {
  constructor(
    private readonly repo: RemindersRepository,
    private readonly core: RemindersService,
  ) {}
  list(
    q: ReminderReportDto,
    user: AuthenticatedUser,
    now = new Date(),
    exporting = false,
  ) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      if (user.role !== 'ADMIN')
        throw new ForbiddenException(
          'Follow-up reports are available only to Admin.',
        );
      const preference = await tx.reminderUserPreference.findUnique({
          where: { userId: user.userId },
        }),
        zone =
          q.displayTimeZone ??
          preference?.displayTimeZone ??
          (await readReminderPolicy(tx)).defaultDisplayTimeZone;
      if (Boolean(q.from) !== Boolean(q.to))
        throw new BadRequestException('Provide both report dates.');
      const start = q.from ? taskDayStart(q.from, zone) : undefined,
        end = q.to ? taskDayStart(taskDateShift(q.to, 1), zone) : undefined;
      if (
        start &&
        end &&
        (end <= start || end.getTime() - start.getTime() > 367 * 86400000)
      )
        throw new BadRequestException(
          'Choose a report range of at most one year.',
        );
      const range = {
          ...(start ? { gte: start } : {}),
          ...(end ? { lt: end } : {}),
        },
        hasRange = Boolean(start),
        limit = exporting ? 10001 : Math.min(q.limit ?? 20, 100),
        skip = exporting ? 0 : ((q.page ?? 1) - 1) * limit;
      const future = {
        deletedAt: null,
        status: {
          in: ['OPEN', 'SNOOZED'] as Prisma.EnumReminderStatusFilter['in'],
        },
        dueAt: { gt: now },
        ...(q.typeKey ? { typeKey: q.typeKey } : {}),
      };
      let rows: ReportRow[] = [],
        total = 0,
        periodBasis = 'Record date';
      if (q.kind === 'LEADS_NO_NEXT') {
        periodBasis = 'Lead date';
        const where: Prisma.LeadWhereInput = {
          convertedOrderId: null,
          status: { in: [...actionableLeadStatuses] },
          ...(q.ownerId ? { createdById: q.ownerId } : {}),
          ...(hasRange ? { leadDate: range } : {}),
          reminders: { none: { ...future, context: 'LEAD' } },
        };
        const [items, count] = await Promise.all([
          tx.lead.findMany({
            where,
            select: {
              id: true,
              leadDate: true,
              customerName: true,
              createdBy: { select: { name: true } },
            },
            orderBy: [{ leadDate: 'desc' }, { id: 'asc' }],
            skip,
            take: limit,
          }),
          tx.lead.count({ where }),
        ]);
        total = count;
        const enriched = await attachTableFollowUps(
          tx,
          items,
          'LEAD',
          user,
          now,
        );
        rows = enriched.map((r) => ({
          id: r.id,
          reference: 'Lead',
          customer: r.customerName,
          owner: r.createdBy.name,
          date: r.leadDate.toISOString(),
          href: `/leads/${r.id}`,
          followUp: r.followUp,
        }));
      } else if (q.kind === 'WEBSITE_NO_NEXT') {
        periodBasis = 'Inquiry received date';
        const where: Prisma.WebsiteLeadWhereInput = {
          status: { in: ['NEW', 'CONTACTED'] },
          ...(q.ownerId ? { assignedToId: q.ownerId } : {}),
          ...(hasRange ? { submittedAt: range } : {}),
          reminders: { none: { ...future, context: 'WEBSITE_LEAD' } },
        };
        const [items, count] = await Promise.all([
          tx.websiteLead.findMany({
            where,
            select: {
              id: true,
              submittedAt: true,
              customerName: true,
              assignedTo: { select: { name: true } },
            },
            orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
            skip,
            take: limit,
          }),
          tx.websiteLead.count({ where }),
        ]);
        total = count;
        const enriched = await attachTableFollowUps(
          tx,
          items,
          'WEBSITE_LEAD',
          user,
          now,
        );
        rows = enriched.map((r) => ({
          id: r.id,
          reference: 'Website inquiry',
          customer: r.customerName ?? 'Unnamed inquiry',
          owner: r.assignedTo?.name ?? 'Unassigned',
          date: r.submittedAt.toISOString(),
          href: `/website-leads/${r.id}`,
          followUp: r.followUp,
        }));
      } else if (q.kind === 'UNSIGNED') {
        periodBasis = 'Signature request date';
        const where: Prisma.InvoiceWhereInput = {
          signatureRequestedAt: hasRange ? range : { not: null },
          signedAt: null,
          order: {
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
            ...(q.ownerId ? { createdById: q.ownerId } : {}),
          },
        };
        const [items, count] = await Promise.all([
          tx.invoice.findMany({
            where,
            select: {
              id: true,
              invoiceNumber: true,
              signatureRequestedAt: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  salesNumber: true,
                  customerName: true,
                  createdBy: { select: { name: true } },
                },
              },
            },
            orderBy: [{ signatureRequestedAt: 'asc' }, { id: 'asc' }],
            skip,
            take: limit,
          }),
          tx.invoice.count({ where }),
        ]);
        total = count;
        const enriched = await attachTableFollowUps(
          tx,
          items.map((r) => ({
            ...r.order,
            invoiceId: r.id,
            requested: r.signatureRequestedAt,
          })),
          'ORDER',
          user,
          now,
          'SIGNATURE_FOLLOW_UP',
        );
        rows = enriched.map((r) => ({
          id: r.invoiceId,
          reference: r.salesNumber || r.orderNumber,
          customer: r.customerName,
          owner: r.createdBy.name,
          date: r.requested!.toISOString(),
          href: `/orders/${r.id}`,
          followUp: r.followUp,
        }));
      } else if (q.kind === 'UNCHECKED_SHIPMENTS') {
        periodBasis = 'Shipment sent date (created date if not recorded)';
        const where: Prisma.ShipmentWhereInput = {
          status: { in: ['SHIPPED', 'IN_TRANSIT'] },
          order: {
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
            ...(q.ownerId ? { createdById: q.ownerId } : {}),
          },
          ...(hasRange
            ? {
                OR: [
                  { shippedAt: range },
                  { shippedAt: null, createdAt: range },
                ],
              }
            : {}),
          reminders: {
            none: {
              ...future,
              context: 'SHIPMENT',
              ownerKind: 'SHIPPING_QUEUE',
              typeKey: 'TRACKING_CHECK',
              dueAt: { gt: now, lte: new Date(now.getTime() + 48 * 3600000) },
            },
          },
        };
        const [items, count] = await Promise.all([
          tx.shipment.findMany({
            where,
            select: {
              id: true,
              shippedAt: true,
              createdAt: true,
              order: {
                select: {
                  orderNumber: true,
                  salesNumber: true,
                  customerName: true,
                },
              },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            skip,
            take: limit,
          }),
          tx.shipment.count({ where }),
        ]);
        total = count;
        const enriched = await attachTableFollowUps(
          tx,
          items,
          'SHIPMENT',
          user,
          now,
          'TRACKING_CHECK',
        );
        rows = enriched.map((r) => ({
          id: r.id,
          reference: r.order.salesNumber || r.order.orderNumber,
          customer: r.order.customerName,
          owner: 'Shipping queue',
          date: (r.shippedAt ?? r.createdAt).toISOString(),
          href: `/shipments/${r.id}`,
          followUp: r.followUp,
        }));
      } else {
        periodBasis = 'Manual completion date';
        const raw = await tx.$queryRaw<
          Array<{
            id: string;
            name: string;
            typeKey: string;
            label: string;
            completed: bigint;
            onTime: bigint;
            queueCount: bigint;
            queueDelay: Prisma.Decimal | null;
          }>
        >(Prisma.sql`
      SELECT u.id,u.name,r."typeKey",t.label,COUNT(*) AS completed,
        COUNT(*) FILTER(WHERE r."completedAt"<=r."dueAt") AS "onTime",
        COUNT(*) FILTER(WHERE r."ownerKind"='SHIPPING_QUEUE') AS "queueCount",
        AVG(GREATEST(0,EXTRACT(EPOCH FROM (r."completedAt"-r."dueAt"))/60)) FILTER(WHERE r."ownerKind"='SHIPPING_QUEUE') AS "queueDelay"
      FROM "Reminder" r JOIN "User" u ON u.id=r."completedById" JOIN "ReminderType" t ON t.key=r."typeKey"
      WHERE r.status='COMPLETED' AND r."deletedAt" IS NULL
      ${start ? Prisma.sql`AND r."completedAt">=${start}` : Prisma.empty} ${end ? Prisma.sql`AND r."completedAt"<${end}` : Prisma.empty}
      ${q.ownerId ? Prisma.sql`AND r."completedById"=${q.ownerId}::uuid` : Prisma.empty} ${q.typeKey ? Prisma.sql`AND r."typeKey"=${q.typeKey}` : Prisma.empty}
      GROUP BY u.id,u.name,r."typeKey",t.label ORDER BY u.name,t.label,u.id`);
        total = raw.length;
        rows = raw
          .slice(skip, skip + limit)
          .map((r) => ({
            id: `${r.id}:${r.typeKey}`,
            reference: r.label,
            customer: '',
            owner: r.name,
            date: '',
            href: `/my-tasks?scope=TEAM&status=COMPLETED&typeKey=${encodeURIComponent(r.typeKey)}`,
            type: r.label,
            completed: Number(r.completed),
            onTime: Number(r.onTime),
            onTimePercent:
              Math.round((Number(r.onTime) / Number(r.completed)) * 1000) / 10,
            queueCount: Number(r.queueCount),
            queueDelayMinutes:
              r.queueDelay === null
                ? null
                : Math.round(Number(r.queueDelay) * 10) / 10,
          }));
      }
      if (exporting && total > 10000)
        throw new BadRequestException(
          'More than 10,000 report rows. Narrow the dates or owner before exporting.',
        );
      const [owners, types] = await Promise.all([
        tx.user.findMany({
          select: { id: true, name: true, isActive: true },
          orderBy: { name: 'asc' },
        }),
        tx.reminderType.findMany({
          select: { key: true, label: true },
          orderBy: { label: 'asc' },
        }),
      ]);
      return {
        rows,
        total,
        page: exporting ? 1 : (q.page ?? 1),
        limit,
        kind: q.kind,
        periodBasis,
        displayTimeZone: zone,
        owners,
        types,
        asOf: now.toISOString(),
      };
    });
  }
  async export(q: ReminderReportDto, user: AuthenticatedUser) {
    const report = await this.list(q, user, new Date(), true),
      performance = q.kind === 'PERFORMANCE';
    return buildOrdersExportWorkbook({
      sheetName: 'Follow-ups',
      columns: (performance
        ? [
            'User',
            'Reminder type',
            'Completed',
            'On time',
            'On-time %',
            'Queue completions',
            'Average queue delay (minutes)',
          ]
        : [
            'Record',
            'Customer',
            'Owner',
            'Record date (report zone)',
            'Next outstanding task (customer zone)',
          ]
      ).map((header) => ({
        header,
        width: header.length > 30 ? 55 : 26,
        wrap: true,
      })),
      rows: report.rows.map((r) =>
        performance
          ? [
              r.owner,
              r.type,
              r.completed,
              r.onTime,
              r.onTimePercent,
              r.queueCount,
              r.queueDelayMinutes,
            ]
          : [
              r.reference,
              r.customer,
              r.owner,
              new Intl.DateTimeFormat('en-US', {
                timeZone: report.displayTimeZone,
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(r.date)) + ` (${report.displayTimeZone})`,
              exportFollowUp(r.followUp),
            ],
      ),
    });
  }
}
