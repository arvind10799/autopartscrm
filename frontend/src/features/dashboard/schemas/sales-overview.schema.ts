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
