import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
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

@Injectable()
export class DashboardService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSalesOverview(query: QuerySalesOverviewDto) {
    const period = this.resolvePacificMonthRange(query.month);

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
        where: {
          leadDate: {
            gte: period.start,
            lt: period.end,
          },
        },
        select: {
          createdById: true,
        },
      }),
      this.prismaService.order.findMany({
        where: {
          createdAt: {
            gte: period.start,
            lt: period.end,
          },
          status: {
            in: COMPLETED_SALE_STATUSES,
          },
        },
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

  private resolvePacificMonthRange(month?: string) {
    const selectedMonth = month ?? this.getPacificMonthKey(new Date());
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
