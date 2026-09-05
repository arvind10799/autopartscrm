export type DashboardTab = 'sales-overview' | 'order-status' | 'agent-leads';

export type SalesOverviewSortKey =
  | 'agentName'
  | 'totalCalls'
  | 'totalSales'
  | 'totalCharging'
  | 'grossProfit';

export type SalesOverviewAgent = {
  agentId: string;
  agentName: string;
  agentEmail: string;
  role: 'ADMIN' | 'SALES' | 'SHIPPING';
  initials: string;
  totalCalls: number;
  totalSales: number;
  totalCharging: number;
  grossProfit: number;
};

export type SalesOverviewTotals = {
  totalCalls: number;
  totalSales: number;
  totalCharging: number;
  grossProfit: number;
};

export type SalesOverviewResponse = {
  selectedMonth: string | null;
  periodLabel: string;
  currency: string;
  generatedAt: string;
  totals: SalesOverviewTotals;
  agents: SalesOverviewAgent[];
};
