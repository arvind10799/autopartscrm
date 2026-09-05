import { z } from 'zod';
import { USER_ROLES } from '@/features/auth/types/auth.types';

export const salesOverviewAgentSchema = z.object({
  agentId: z.string().uuid(),
  agentName: z.string(),
  agentEmail: z.string(),
  role: z.enum(USER_ROLES),
  initials: z.string(),
  totalCalls: z.coerce.number(),
  totalSales: z.coerce.number(),
  totalCharging: z.coerce.number(),
  grossProfit: z.coerce.number(),
});

export const salesOverviewTotalsSchema = z.object({
  totalCalls: z.coerce.number(),
  totalSales: z.coerce.number(),
  totalCharging: z.coerce.number(),
  grossProfit: z.coerce.number(),
});

export const salesOverviewSchema = z.object({
  selectedMonth: z.string().nullable(),
  periodLabel: z.string(),
  currency: z.string(),
  generatedAt: z.string(),
  totals: salesOverviewTotalsSchema,
  agents: z.array(salesOverviewAgentSchema),
});

const orderStatusDashboardStatusSchema = z.enum([
  'PENDING',
  'LOCATING',
  'PRE_PROCESSING',
  'PURCHASE',
  'SHIPPED',
  'IN_TRANSIT',
  'DISPUTED',
  'DELIVERED',
  'DELAYED',
  'CANCELLED',
  'REFUNDED',
]);

export const orderStatusDashboardSchema = z.object({
  selectedMonth: z.string().nullable(),
  periodLabel: z.string(),
  overdueDays: z.coerce.number(),
  generatedAt: z.string(),
  agents: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      role: z.enum(USER_ROLES),
      initials: z.string(),
    }),
  ),
  statusOptions: z.array(orderStatusDashboardStatusSchema),
  totals: z.object({
    pendingOrders: z.coerce.number(),
    averageAgeing: z.coerce.number(),
    deliveredMtd: z.coerce.number(),
    overdueOrders: z.coerce.number(),
  }),
  orders: z.array(
    z.object({
      id: z.string().uuid(),
      orderNumber: z.string(),
      salesNumber: z.string().nullable(),
      customerName: z.string(),
      agentId: z.string().uuid(),
      agentName: z.string(),
      agentEmail: z.string(),
      agentInitials: z.string(),
      saleDate: z.string(),
      ageingDays: z.coerce.number(),
      status: orderStatusDashboardStatusSchema,
      isPending: z.boolean(),
      isOverdue: z.boolean(),
      deliveredAt: z.string().nullable(),
    }),
  ),
});
