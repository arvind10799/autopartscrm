import { BadRequestException, Injectable } from '@nestjs/common';
import {
  LeadStatus,
  OrderStatus,
  Prisma,
  Role,
  ShipmentStatus,
} from '@prisma/client';
import {
  createPaginatedResponse,
  getPaginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { QueryAgentLeadsDashboardDto } from './dto/query-agent-leads-dashboard.dto';
import { QueryOrderStatusDashboardDto } from './dto/query-order-status-dashboard.dto';
import { QuerySalesOverviewDto } from './dto/query-sales-overview.dto';

const PACIFIC_TIME_ZONE = 'America/Los_Angeles';
const COMPLETED_SALE_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
] satisfies OrderStatus[];

type AgentMetric = {
  agentId: string;
  agentName: string;
  agentEmail: string;
  role: Role;
  initials: string;
  totalCalls: number;
  totalSales: number;
  totalCharging: number;
  grossProfit: number;
};

const ORDER_STATUS_DASHBOARD_STATUSES = [
  ShipmentStatus.PENDING,
  ShipmentStatus.LOCATING,
  ShipmentStatus.PRE_PROCESSING,
  ShipmentStatus.PURCHASE,
  ShipmentStatus.SHIPPED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DISPUTED,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.DELAYED,
  ShipmentStatus.CANCELLED,
  OrderStatus.REFUNDED,
] as const;

type OrderStatusDashboardStatus =
  (typeof ORDER_STATUS_DASHBOARD_STATUSES)[number];

const AGENT_LEAD_DASHBOARD_STATUSES = [
  LeadStatus.PROSPECT,
  LeadStatus.QUOTED,
  LeadStatus.CALL_BACK_LATER,
  LeadStatus.SHOPPING_AROUND,
  LeadStatus.NOT_INTERESTED,
  LeadStatus.NEEDS_LOCALLY,
  LeadStatus.WE_DONT_SALE,
] satisfies LeadStatus[];

type AgentLeadMetric = {
  agentId: string;
  agentName: string;
  agentEmail: string;
  role: Role;
  initials: string;
  totalLeads: number;
  totalProspects: number;
  lastUpdated: string | null;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSalesOverview(query: QuerySalesOverviewDto) {
    const period = this.resolveSalesOverviewPeriod(query.month);
    const leadWhere: Prisma.LeadWhereInput = period.start
      ? {
          leadDate: {
            gte: period.start,
            lt: period.end,
          },
        }
      : {};
    const orderWhere: Prisma.OrderWhereInput = {
      ...(period.start
        ? {
            createdAt: {
              gte: period.start,
              lt: period.end,
            },
          }
        : {}),
      status: {
        in: COMPLETED_SALE_STATUSES,
      },
    };

    const [users, leads, orders] = await this.prismaService.$transaction([
      this.prismaService.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      this.prismaService.lead.findMany({
        where: leadWhere,
        select: {
          createdById: true,
        },
      }),
      this.prismaService.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          createdById: true,
          totalSaleAmount: true,
          shipments: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            select: {
              costs: {
                take: 1,
                select: {
                  purchaseAmount: true,
                  shippingAmount: true,
                  estimatedPurchaseAmount: true,
                  estimatedShippingAmount: true,
                  hasActualPurchaseAmount: true,
                  hasActualShippingAmount: true,
                  additionalAmount: true,
                },
              },
              additionalCosts: {
                select: {
                  amount: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const agentMap = new Map<string, AgentMetric>();

    users.forEach((user) => {
      if (user.role === Role.ADMIN || user.role === Role.SALES) {
        agentMap.set(user.id, {
          agentId: user.id,
          agentName: user.name,
          agentEmail: user.email,
          role: user.role,
          initials: this.buildInitials(user.name),
          totalCalls: 0,
          totalSales: 0,
          totalCharging: 0,
          grossProfit: 0,
        });
      }
    });

    const ensureAgent = (userId: string) => {
      const existing = agentMap.get(userId);

      if (existing) {
        return existing;
      }

      const user = users.find((item) => item.id === userId);
      const fallbackName = user?.name ?? 'Unknown Agent';
      const metric: AgentMetric = {
        agentId: userId,
        agentName: fallbackName,
        agentEmail: user?.email ?? '',
        role: user?.role ?? Role.SALES,
        initials: this.buildInitials(fallbackName),
        totalCalls: 0,
        totalSales: 0,
        totalCharging: 0,
        grossProfit: 0,
      };
      agentMap.set(userId, metric);

      return metric;
    };

    leads.forEach((lead) => {
      ensureAgent(lead.createdById).totalCalls += 1;
    });

    orders.forEach((order) => {
      const agent = ensureAgent(order.createdById);
      const saleAmount = Number(order.totalSaleAmount);

      agent.totalSales += 1;
      agent.totalCharging += saleAmount;
      agent.grossProfit += this.calculateOrderGrossProfit(order);
    });

    const agents = [...agentMap.values()]
      .filter(
        (agent) =>
          agent.totalCalls > 0 ||
          agent.totalSales > 0 ||
          agent.totalCharging > 0 ||
          agent.grossProfit !== 0,
      )
      .sort((first, second) =>
        first.agentName.localeCompare(second.agentName, undefined, {
          sensitivity: 'base',
        }),
      );

    const totals = agents.reduce(
      (summary, agent) => ({
        totalCalls: summary.totalCalls + agent.totalCalls,
        totalSales: summary.totalSales + agent.totalSales,
        totalCharging: summary.totalCharging + agent.totalCharging,
        grossProfit: summary.grossProfit + agent.grossProfit,
      }),
      {
        totalCalls: 0,
        totalSales: 0,
        totalCharging: 0,
        grossProfit: 0,
      },
    );

    return {
      selectedMonth: period.selectedMonth,
      periodLabel: period.label,
      currency: 'USD',
      generatedAt: new Date().toISOString(),
      totals,
      agents,
    };
  }

  async getOrderStatus(query: QueryOrderStatusDashboardDto) {
    const period = this.resolveSalesOverviewPeriod(query.month);
    const overdueDays = query.overdueDays ?? 14;
    const { page, limit, skip } = getPaginationParams(
      query.page,
      query.limit ?? 20,
    );
    const search = query.search?.trim();
    const statusFilter = this.normalizeOrderStatusDashboardStatus(query.status);
    const ageingRange = this.normalizeAgeingRange(query.ageingRange);
    const currentDate = new Date();
    const orderWhere: Prisma.OrderWhereInput = {
      ...(period.start
        ? {
            createdAt: {
              gte: period.start,
              lt: period.end,
            },
          }
        : {}),
      ...(query.agentId ? { createdById: query.agentId } : {}),
    };

    if (search) {
      orderWhere.OR = [
        {
          orderNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          salesNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          customerName: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [users, orders] = await this.prismaService.$transaction([
      this.prismaService.user.findMany({
        where: {
          role: {
            in: [Role.ADMIN, Role.SALES],
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      this.prismaService.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          orderNumber: true,
          salesNumber: true,
          customerName: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          shipments: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            select: {
              id: true,
              status: true,
              deliveredAt: true,
              updatedAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const rows = orders
      .map((order) => {
        const latestShipment = order.shipments[0] ?? null;
        const status = this.resolveCurrentOrderFulfillmentStatus(
          order.status,
          latestShipment?.status,
        );
        const ageingDays = this.calculatePacificAgeingDays(
          order.createdAt,
          currentDate,
        );
        const deliveredAt =
          latestShipment?.deliveredAt ??
          (order.status === OrderStatus.DELIVERED ? order.updatedAt : null);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          salesNumber: order.salesNumber,
          customerName: order.customerName,
          agentId: order.createdBy.id,
          agentName: order.createdBy.name,
          agentEmail: order.createdBy.email,
          agentInitials: this.buildInitials(order.createdBy.name),
          saleDate: order.createdAt.toISOString(),
          ageingDays,
          status,
          isPending: this.isPendingFulfillmentStatus(status),
          isOverdue:
            this.isPendingFulfillmentStatus(status) && ageingDays > overdueDays,
          deliveredAt: deliveredAt?.toISOString() ?? null,
        };
      })
      .filter((row) => !statusFilter || row.status === statusFilter)
      .filter((row) => this.matchesAgeingRange(row.ageingDays, ageingRange));

    const pendingRows = rows.filter((row) => row.isPending);
    const deliveredRows = rows.filter(
      (row) =>
        row.status === ShipmentStatus.DELIVERED &&
        this.isDateWithinPeriod(row.deliveredAt, period),
    );
    const overdueRows = rows.filter((row) => row.isOverdue);
    const averageAgeing =
      pendingRows.length > 0
        ? Math.round(
            pendingRows.reduce((sum, row) => sum + row.ageingDays, 0) /
              pendingRows.length,
          )
        : 0;
    const paginatedRows = rows.slice(skip, skip + limit);
    const paginatedOrders = createPaginatedResponse(
      paginatedRows,
      rows.length,
      page,
      limit,
    );

    return {
      selectedMonth: period.selectedMonth,
      periodLabel: period.label,
      overdueDays,
      generatedAt: currentDate.toISOString(),
      agents: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: this.buildInitials(user.name),
      })),
      statusOptions: ORDER_STATUS_DASHBOARD_STATUSES,
      totals: {
        pendingOrders: pendingRows.length,
        averageAgeing,
        deliveredMtd: deliveredRows.length,
        overdueOrders: overdueRows.length,
      },
      orders: paginatedOrders.items,
      meta: paginatedOrders.meta,
    };
  }

  async getAgentLeads(query: QueryAgentLeadsDashboardDto) {
    const month = query.month ?? this.getPacificMonthKey(new Date());
    const period = this.resolveSalesOverviewPeriod(month);
    const search = query.search?.trim();
    const leadWhere: Prisma.LeadWhereInput = {
      ...(period.start
        ? {
            leadDate: {
              gte: period.start,
              lt: period.end,
            },
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const userWhere: Prisma.UserWhereInput = {
      role: {
        in: [Role.ADMIN, Role.SALES],
      },
      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [users, leads] = await this.prismaService.$transaction([
      this.prismaService.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      this.prismaService.lead.findMany({
        where: leadWhere,
        select: {
          createdById: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

    const agentMap = new Map<string, AgentLeadMetric>();

    users.forEach((user) => {
      agentMap.set(user.id, {
        agentId: user.id,
        agentName: user.name,
        agentEmail: user.email,
        role: user.role,
        initials: this.buildInitials(user.name),
        totalLeads: 0,
        totalProspects: 0,
        lastUpdated: null,
      });
    });

    leads.forEach((lead) => {
      const agent = agentMap.get(lead.createdById);

      if (!agent) {
        return;
      }

      agent.totalLeads += 1;

      if (lead.status === LeadStatus.PROSPECT) {
        agent.totalProspects += 1;
      }

      if (
        !agent.lastUpdated ||
        lead.updatedAt > new Date(agent.lastUpdated)
      ) {
        agent.lastUpdated = lead.updatedAt.toISOString();
      }
    });

    const agents = [...agentMap.values()]
      .filter((agent) => agent.totalLeads > 0 || Boolean(search))
      .sort((first, second) =>
        first.agentName.localeCompare(second.agentName, undefined, {
          sensitivity: 'base',
        }),
      );

    return {
      selectedMonth: period.selectedMonth,
      periodLabel: period.label,
      selectedStatus: query.status ?? null,
      statusOptions: AGENT_LEAD_DASHBOARD_STATUSES,
      generatedAt: new Date().toISOString(),
      totals: agents.reduce(
        (summary, agent) => ({
          totalLeads: summary.totalLeads + agent.totalLeads,
          totalProspects: summary.totalProspects + agent.totalProspects,
        }),
        {
          totalLeads: 0,
          totalProspects: 0,
        },
      ),
      agents,
    };
  }

  private calculateOrderGrossProfit(order: {
    totalSaleAmount: Prisma.Decimal;
    shipments: Array<{
      costs: Array<{
        purchaseAmount: Prisma.Decimal;
        shippingAmount: Prisma.Decimal;
        estimatedPurchaseAmount: Prisma.Decimal;
        estimatedShippingAmount: Prisma.Decimal;
        hasActualPurchaseAmount: boolean;
        hasActualShippingAmount: boolean;
        additionalAmount: Prisma.Decimal;
      }>;
      additionalCosts: Array<{
        amount: Prisma.Decimal;
      }>;
    }>;
  }): number {
    const saleAmount = Number(order.totalSaleAmount);
    const shipment = order.shipments[0];
    const cost = shipment?.costs[0];

    if (!cost) {
      return saleAmount;
    }

    const effectivePurchaseAmount = cost.hasActualPurchaseAmount
      ? Number(cost.purchaseAmount)
      : Number(cost.estimatedPurchaseAmount);
    const effectiveShippingAmount = cost.hasActualShippingAmount
      ? Number(cost.shippingAmount)
      : Number(cost.estimatedShippingAmount);
    const additionalAmount =
      shipment.additionalCosts.length > 0
        ? shipment.additionalCosts.reduce(
            (sum, item) => sum + Number(item.amount),
            0,
          )
        : Number(cost.additionalAmount);

    return saleAmount - effectivePurchaseAmount - effectiveShippingAmount - additionalAmount;
  }

  private resolveSalesOverviewPeriod(month?: string) {
    if (!month) {
      return {
        selectedMonth: null,
        start: null,
        end: null,
        label: 'All time',
      };
    }

    const selectedMonth = month;
    const [yearText, monthText] = selectedMonth.split('-');
    const year = Number(yearText);
    const monthNumber = Number(monthText);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(monthNumber) ||
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      throw new BadRequestException('month must use YYYY-MM format.');
    }

    const start = this.zonedTimeToUtc(year, monthNumber, 1);
    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
    const nextMonthStart = this.zonedTimeToUtc(nextYear, nextMonth, 1);
    const currentPacificMonth = this.getPacificMonthKey(new Date());
    const end =
      selectedMonth === currentPacificMonth && new Date() < nextMonthStart
        ? new Date()
        : nextMonthStart;

    return {
      selectedMonth,
      start,
      end,
      label: new Intl.DateTimeFormat('en-US', {
        timeZone: PACIFIC_TIME_ZONE,
        month: 'long',
        year: 'numeric',
      }).format(start),
    };
  }

  private resolveCurrentOrderFulfillmentStatus(
    orderStatus: OrderStatus,
    shipmentStatus?: ShipmentStatus,
  ): OrderStatusDashboardStatus {
    if (orderStatus === OrderStatus.CANCELLED) {
      return ShipmentStatus.CANCELLED;
    }

    if (orderStatus === OrderStatus.REFUNDED) {
      return OrderStatus.REFUNDED;
    }

    if (shipmentStatus) {
      return shipmentStatus;
    }

    return ShipmentStatus.PENDING;
  }

  private isPendingFulfillmentStatus(status: OrderStatusDashboardStatus) {
    return status !== ShipmentStatus.DELIVERED &&
      status !== ShipmentStatus.CANCELLED &&
      status !== OrderStatus.REFUNDED;
  }

  private normalizeOrderStatusDashboardStatus(
    status?: string,
  ): OrderStatusDashboardStatus | null {
    if (!status || status === 'ALL') {
      return null;
    }

    if (
      ORDER_STATUS_DASHBOARD_STATUSES.includes(
        status as OrderStatusDashboardStatus,
      )
    ) {
      return status as OrderStatusDashboardStatus;
    }

    throw new BadRequestException('status filter is invalid.');
  }

  private normalizeAgeingRange(ageingRange?: string) {
    if (!ageingRange || ageingRange === 'ALL') {
      return null;
    }

    if (['0-7', '8-14', '15-30', '31+'].includes(ageingRange)) {
      return ageingRange;
    }

    throw new BadRequestException('ageingRange filter is invalid.');
  }

  private matchesAgeingRange(ageingDays: number, ageingRange: string | null) {
    switch (ageingRange) {
      case '0-7':
        return ageingDays >= 0 && ageingDays <= 7;
      case '8-14':
        return ageingDays >= 8 && ageingDays <= 14;
      case '15-30':
        return ageingDays >= 15 && ageingDays <= 30;
      case '31+':
        return ageingDays >= 31;
      default:
        return true;
    }
  }

  private isDateWithinPeriod(
    value: string | null,
    period: ReturnType<DashboardService['resolveSalesOverviewPeriod']>,
  ) {
    if (!value) {
      return false;
    }

    if (!period.start || !period.end) {
      return true;
    }

    const date = new Date(value);

    return date >= period.start && date < period.end;
  }

  private calculatePacificAgeingDays(startDate: Date, endDate: Date) {
    const start = this.getPacificDateParts(startDate);
    const end = this.getPacificDateParts(endDate);
    const startUtc = Date.UTC(start.year, start.month - 1, start.day);
    const endUtc = Date.UTC(end.year, end.month - 1, end.day);

    return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
  }

  private getPacificDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: PACIFIC_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);

    return {
      year: valueFor('year'),
      month: valueFor('month'),
      day: valueFor('day'),
    };
  }

  private getPacificMonthKey(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: PACIFIC_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;

    return `${year}-${month}`;
  }

  private zonedTimeToUtc(
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0,
  ) {
    const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second);
    const firstPassOffset = this.getTimeZoneOffsetMs(
      new Date(utcTimestamp),
      PACIFIC_TIME_ZONE,
    );
    const firstPassDate = new Date(utcTimestamp - firstPassOffset);
    const finalOffset = this.getTimeZoneOffsetMs(firstPassDate, PACIFIC_TIME_ZONE);

    return new Date(utcTimestamp - finalOffset);
  }

  private getTimeZoneOffsetMs(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const localAsUtc = Date.UTC(
      valueFor('year'),
      valueFor('month') - 1,
      valueFor('day'),
      valueFor('hour'),
      valueFor('minute'),
      valueFor('second'),
    );

    return localAsUtc - date.getTime();
  }

  private buildInitials(name: string) {
    const initials = name
      .split(' ')
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return initials || 'AG';
  }
}
