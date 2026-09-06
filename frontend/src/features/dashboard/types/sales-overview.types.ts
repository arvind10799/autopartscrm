export type DashboardTab = 'sales-overview' | 'order-status' | 'agent-leads';

export type AgentLeadStatus =
  | 'PROSPECT'
  | 'QUOTED'
  | 'CALL_BACK_LATER'
  | 'SHOPPING_AROUND'
  | 'NOT_INTERESTED'
  | 'NEEDS_LOCALLY'
  | 'WE_DONT_SALE';

export type SalesOverviewSortKey =
  | 'agentName'
  | 'totalCalls'
  | 'totalSales'
  | 'totalCharging'
  | 'grossProfit';

export type AgentLeadsSortKey =
  | 'agentName'
  | 'totalLeads'
  | 'totalProspects'
  | 'lastUpdated';

export type OrderStatusDashboardStatus =
  | 'PENDING'
  | 'LOCATING'
  | 'PRE_PROCESSING'
  | 'PURCHASE'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'DISPUTED'
  | 'DELIVERED'
  | 'DELAYED'
  | 'CANCELLED'
  | 'REFUNDED';

export type OrderStatusAgeingRange = 'ALL' | '0-7' | '8-14' | '15-30' | '31+';

export type OrderStatusSortKey =
  | 'salesNumber'
  | 'orderNumber'
  | 'customerName'
  | 'agentName'
  | 'saleDate'
  | 'ageingDays'
  | 'status';

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

export type OrderStatusDashboardAgent = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'SHIPPING';
  initials: string;
};

export type OrderStatusDashboardOrder = {
  id: string;
  orderNumber: string;
  salesNumber: string | null;
  customerName: string;
  agentId: string;
  agentName: string;
  agentEmail: string;
  agentInitials: string;
  saleDate: string;
  ageingDays: number;
  status: OrderStatusDashboardStatus;
  isPending: boolean;
  isOverdue: boolean;
  deliveredAt: string | null;
};

export type OrderStatusDashboardTotals = {
  pendingOrders: number;
  averageAgeing: number;
  deliveredMtd: number;
  overdueOrders: number;
};

export type OrderStatusDashboardMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type OrderStatusDashboardResponse = {
  selectedMonth: string | null;
  periodLabel: string;
  overdueDays: number;
  generatedAt: string;
  agents: OrderStatusDashboardAgent[];
  statusOptions: OrderStatusDashboardStatus[];
  totals: OrderStatusDashboardTotals;
  orders: OrderStatusDashboardOrder[];
  meta: OrderStatusDashboardMeta;
};

export type OrderStatusDashboardQuery = {
  month?: string | null;
  search?: string;
  status?: string;
  agentId?: string;
  ageingRange?: OrderStatusAgeingRange;
  overdueDays?: number;
  page?: number;
  limit?: number;
};

export type AgentLeadsDashboardAgent = {
  agentId: string;
  agentName: string;
  agentEmail: string;
  role: 'ADMIN' | 'SALES' | 'SHIPPING';
  initials: string;
  totalLeads: number;
  totalProspects: number;
  lastUpdated: string | null;
};

export type AgentLeadsDashboardTotals = {
  totalLeads: number;
  totalProspects: number;
};

export type AgentLeadsDashboardResponse = {
  selectedMonth: string | null;
  periodLabel: string;
  selectedStatus: AgentLeadStatus | null;
  statusOptions: AgentLeadStatus[];
  generatedAt: string;
  totals: AgentLeadsDashboardTotals;
  agents: AgentLeadsDashboardAgent[];
};

export type AgentLeadsDashboardQuery = {
  month?: string;
  search?: string;
  status?: string;
};
