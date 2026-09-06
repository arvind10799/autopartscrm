'use client';

import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  DollarSign,
  PackageCheck,
  PhoneCall,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatLeadStatusLabel } from '@/features/leads/lib/leads.helpers';
import { ShipmentStatusBadge } from '@/features/shipments/components/ShipmentStatusBadge';
import { cn } from '@/lib/utils/cn';
import { getPacificTodayDateInputValue } from '@/lib/utils/pacific-date';
import {
  formatDate,
  formatDateTime,
} from '@/features/orders/lib/order-formatters';
import { dashboardApi } from '../api/dashboard-api';
import type {
  AgentLeadsDashboardAgent,
  AgentLeadsDashboardResponse,
  AgentLeadsSortKey,
  DashboardTab,
  OrderStatusAgeingRange,
  OrderStatusDashboardOrder,
  OrderStatusDashboardResponse,
  OrderStatusDashboardStatus,
  OrderStatusSortKey,
  SalesOverviewAgent,
  SalesOverviewResponse,
  SalesOverviewSortKey,
} from '../types/sales-overview.types';

const DASHBOARD_TABS: Array<{
  id: DashboardTab;
  label: string;
}> = [
  {
    id: 'sales-overview',
    label: 'Sales Overview',
  },
  {
    id: 'order-status',
    label: 'Order Status',
  },
  {
    id: 'agent-leads',
    label: 'Agent Leads',
  },
];

const ORDER_STATUS_PAGE_SIZE = 20;

type SortState = {
  key: SalesOverviewSortKey;
  direction: 'asc' | 'desc';
};

type OrderStatusSortState = {
  key: OrderStatusSortKey;
  direction: 'asc' | 'desc';
};

type AgentLeadsSortState = {
  key: AgentLeadsSortKey;
  direction: 'asc' | 'desc';
};

export function DashboardWorkspace() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<DashboardTab>('sales-overview');
  const [periodMode, setPeriodMode] = useState<'all' | 'month'>('month');
  const [selectedMonth, setSelectedMonth] = useState(() =>
    getPacificTodayDateInputValue().slice(0, 7),
  );
  const [salesOverview, setSalesOverview] =
    useState<SalesOverviewResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoadingSalesOverview, setIsLoadingSalesOverview] = useState(true);
  const [salesOverviewError, setSalesOverviewError] = useState<string | null>(
    null,
  );
  const [orderStatus, setOrderStatus] =
    useState<OrderStatusDashboardResponse | null>(null);
  const [isLoadingOrderStatus, setIsLoadingOrderStatus] = useState(false);
  const [orderStatusError, setOrderStatusError] = useState<string | null>(null);
  const [orderSearchInput, setOrderSearchInput] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderAgentFilter, setOrderAgentFilter] = useState('ALL');
  const [orderAgeingRange, setOrderAgeingRange] =
    useState<OrderStatusAgeingRange>('ALL');
  const [overdueDays, setOverdueDays] = useState(14);
  const [orderPage, setOrderPage] = useState(1);
  const [agentLeads, setAgentLeads] =
    useState<AgentLeadsDashboardResponse | null>(null);
  const [isLoadingAgentLeads, setIsLoadingAgentLeads] = useState(false);
  const [agentLeadsError, setAgentLeadsError] = useState<string | null>(null);
  const [agentLeadSearchInput, setAgentLeadSearchInput] = useState('');
  const [agentLeadStatusFilter, setAgentLeadStatusFilter] = useState('ALL');
  const maxMonth = getPacificTodayDateInputValue().slice(0, 7);
  const deferredOrderSearchInput = useDeferredValue(orderSearchInput);
  const activeOrderSearch = deferredOrderSearchInput.trim();
  const deferredAgentLeadSearchInput = useDeferredValue(agentLeadSearchInput);
  const activeAgentLeadSearch = deferredAgentLeadSearchInput.trim();

  useEffect(() => {
    let isCancelled = false;

    async function loadSalesOverview() {
      if (activeTab !== 'sales-overview') {
        return;
      }

      setIsLoadingSalesOverview(true);
      setSalesOverviewError(null);

      try {
        const response = await dashboardApi.getSalesOverview(
          periodMode === 'all' ? null : selectedMonth || maxMonth,
        );

        if (!isCancelled) {
          setSalesOverview(response);
        }
      } catch (error) {
        if (!isCancelled) {
          setSalesOverviewError(
            error instanceof Error
              ? error.message
              : 'Unable to load sales overview.',
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSalesOverview(false);
        }
      }
    }

    void loadSalesOverview();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, maxMonth, periodMode, refreshKey, selectedMonth]);

  useEffect(() => {
    let isCancelled = false;

    async function loadOrderStatus() {
      if (activeTab !== 'order-status') {
        return;
      }

      setIsLoadingOrderStatus(true);
      setOrderStatusError(null);

      try {
        const response = await dashboardApi.getOrderStatus({
          month: periodMode === 'all' ? null : selectedMonth || maxMonth,
          search: activeOrderSearch,
          status: orderStatusFilter,
          agentId: orderAgentFilter,
          ageingRange: orderAgeingRange,
          overdueDays,
          page: orderPage,
          limit: ORDER_STATUS_PAGE_SIZE,
        });

        if (!isCancelled) {
          setOrderStatus(response);
        }
      } catch (error) {
        if (!isCancelled) {
          setOrderStatusError(
            error instanceof Error
              ? error.message
              : 'Unable to load order status dashboard.',
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingOrderStatus(false);
        }
      }
    }

    void loadOrderStatus();

    return () => {
      isCancelled = true;
    };
  }, [
    activeTab,
    activeOrderSearch,
    maxMonth,
    orderAgeingRange,
    orderAgentFilter,
    orderPage,
    orderStatusFilter,
    overdueDays,
    periodMode,
    refreshKey,
    selectedMonth,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadAgentLeads() {
      if (activeTab !== 'agent-leads') {
        return;
      }

      setIsLoadingAgentLeads(true);
      setAgentLeadsError(null);

      try {
        const response = await dashboardApi.getAgentLeads({
          month: periodMode === 'all' ? undefined : selectedMonth || maxMonth,
          search: activeAgentLeadSearch,
          status: agentLeadStatusFilter,
        });

        if (!isCancelled) {
          setAgentLeads(response);
        }
      } catch (error) {
        if (!isCancelled) {
          setAgentLeadsError(
            error instanceof Error
              ? error.message
              : 'Unable to load agent leads dashboard.',
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAgentLeads(false);
        }
      }
    }

    void loadAgentLeads();

    return () => {
      isCancelled = true;
    };
  }, [
    activeTab,
    activeAgentLeadSearch,
    agentLeadStatusFilter,
    maxMonth,
    periodMode,
    refreshKey,
    selectedMonth,
  ]);

  const updateOrderStatusFilter = (value: string) => {
    setOrderPage(1);
    setOrderStatusFilter(value);
  };

  const updateOrderAgentFilter = (value: string) => {
    setOrderPage(1);
    setOrderAgentFilter(value);
  };

  const updateOrderAgeingRange = (value: OrderStatusAgeingRange) => {
    setOrderPage(1);
    setOrderAgeingRange(value);
  };

  const updateOverdueDays = (value: number) => {
    setOrderPage(1);
    setOverdueDays(value);
  };

  const updateAgentLeadStatusFilter = (value: string) => {
    setAgentLeadStatusFilter(value);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {DASHBOARD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-36">
            <label
              htmlFor="dashboard-period-mode"
              className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              Period
            </label>
            <Select
              id="dashboard-period-mode"
              value={periodMode}
              onChange={(event) => {
                setOrderPage(1);
                setPeriodMode(event.target.value === 'all' ? 'all' : 'month');
              }}
              className="h-9 rounded-xl"
            >
              <option value="all">All time</option>
              <option value="month">Monthly</option>
            </Select>
          </div>

          {periodMode === 'month' ? (
            <div className="min-w-44">
              <label
                htmlFor="dashboard-month"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Month
              </label>
              <Input
                id="dashboard-month"
                type="month"
                value={selectedMonth}
                max={maxMonth}
                onChange={(event) => {
                  setOrderPage(1);
                  setSelectedMonth(event.target.value || maxMonth);
                }}
                className="h-9 rounded-xl"
              />
            </div>
          ) : null}
        </div>
      </div>

      {activeTab === 'sales-overview' ? (
        <SalesOverviewTab
          data={salesOverview}
          isLoading={isLoadingSalesOverview}
          error={salesOverviewError}
          periodMode={periodMode}
          month={periodMode === 'all' ? null : selectedMonth}
          onRetry={() => setRefreshKey((currentValue) => currentValue + 1)}
        />
      ) : activeTab === 'order-status' ? (
        <OrderStatusTab
          data={orderStatus}
          isLoading={isLoadingOrderStatus}
          error={orderStatusError}
          periodMode={periodMode}
          searchInput={orderSearchInput}
          onSearchInputChange={(value) => {
            setOrderSearchInput(value);
            setOrderPage(1);
          }}
          statusFilter={orderStatusFilter}
          onStatusFilterChange={updateOrderStatusFilter}
          agentFilter={orderAgentFilter}
          onAgentFilterChange={updateOrderAgentFilter}
          ageingRange={orderAgeingRange}
          onAgeingRangeChange={updateOrderAgeingRange}
          overdueDays={overdueDays}
          onOverdueDaysChange={updateOverdueDays}
          onPageChange={setOrderPage}
          canConfigureOverdue={user?.role === 'ADMIN'}
          onRetry={() => setRefreshKey((currentValue) => currentValue + 1)}
        />
      ) : (
        <AgentLeadsTab
          data={agentLeads}
          isLoading={isLoadingAgentLeads}
          error={agentLeadsError}
          searchInput={agentLeadSearchInput}
          onSearchInputChange={setAgentLeadSearchInput}
          statusFilter={agentLeadStatusFilter}
          onStatusFilterChange={updateAgentLeadStatusFilter}
          onRetry={() => setRefreshKey((currentValue) => currentValue + 1)}
        />
      )}

      {user?.role ? (
        <p className="text-xs text-muted-foreground">
          Visible for {user.role.toLowerCase()} workspace access.
        </p>
      ) : null}
    </section>
  );
}

function SalesOverviewTab({
  data,
  isLoading,
  error,
  periodMode,
  month,
  onRetry,
}: {
  data: SalesOverviewResponse | null;
  isLoading: boolean;
  error: string | null;
  periodMode: 'all' | 'month';
  month: string | null;
  onRetry: () => void;
}) {
  const [sortState, setSortState] = useState<SortState>({
    key: 'totalCharging',
    direction: 'desc',
  });
  const sortedAgents = useMemo(() => {
    const agents = [...(data?.agents ?? [])];

    agents.sort((first, second) => {
      const direction = sortState.direction === 'asc' ? 1 : -1;

      if (sortState.key === 'agentName') {
        return (
          first.agentName.localeCompare(second.agentName, undefined, {
            sensitivity: 'base',
          }) * direction
        );
      }

      return (first[sortState.key] - second[sortState.key]) * direction;
    });

    return agents;
  }, [data?.agents, sortState]);

  const handleSort = (key: SalesOverviewSortKey) => {
    setSortState((currentState) => ({
      key,
      direction:
        currentState.key === key && currentState.direction === 'desc'
          ? 'asc'
          : 'desc',
    }));
  };

  if (isLoading) {
    return <SalesOverviewSkeleton />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">
              Sales overview is unavailable
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error ?? 'Unable to load dashboard analytics right now.'}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Sales Overview
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">
            {data.periodLabel}
          </h2>
          <p className="text-sm text-muted-foreground">
            Leads are counted as calls. Values update from CRM records for{' '}
            {periodMode === 'all' ? 'all time' : month}.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SalesKpiCard
          icon={<PhoneCall className="h-5 w-5" />}
          label="Total Leads"
          value={data.totals.totalCalls.toLocaleString()}
          hint="Total calls/leads by all agents"
          tone="blue"
        />
        <SalesKpiCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Total Sales"
          value={data.totals.totalSales.toLocaleString()}
          hint="Completed sales in selected month"
          tone="orange"
        />
        <SalesKpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Charging"
          value={formatDashboardCurrency(
            data.totals.totalCharging,
            data.currency,
          )}
          hint="Completed sale value generated"
          tone="violet"
        />
        <SalesKpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Gross Profit"
          value={formatDashboardCurrency(data.totals.grossProfit, data.currency)}
          hint="Sale value minus actual/estimated costs"
          tone="emerald"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-secondary/35 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Agent Performance</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Sort by agent, calls, sales, charging, or gross profit.
              </p>
            </div>
            <Badge variant="outline" className="bg-card">
              {data.agents.length} active agents
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sortedAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold text-foreground">
                No sales activity for this month
              </p>
              <p className="text-sm text-muted-foreground">
                Choose another month or add leads/orders to populate this table.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <SortableHeader
                      label="Agent"
                      sortKey="agentName"
                      activeSort={sortState}
                      onSort={handleSort}
                      align="left"
                    />
                    <SortableHeader
                      label="Total Calls"
                      sortKey="totalCalls"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Total Sales"
                      sortKey="totalSales"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Total Charging"
                      sortKey="totalCharging"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Gross Profit"
                      sortKey="grossProfit"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent) => (
                    <AgentPerformanceRow
                      key={agent.agentId}
                      agent={agent}
                      currency={data.currency}
                    />
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-primary/5">
                  <tr className="font-semibold text-foreground">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          TT
                        </div>
                        <div>
                          <p>Team Total</p>
                          <p className="text-xs font-normal text-muted-foreground">
                            Complete team result
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {data.totals.totalCalls.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {data.totals.totalSales.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {formatDashboardCurrency(
                        data.totals.totalCharging,
                        data.currency,
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {formatDashboardCurrency(
                        data.totals.grossProfit,
                        data.currency,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SalesKpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: 'blue' | 'orange' | 'violet' | 'emerald';
}) {
  const toneClasses = {
    blue: 'bg-blue-500/10 text-blue-600',
    orange: 'bg-orange-500/10 text-orange-600',
    violet: 'bg-violet-500/10 text-violet-600',
    emerald: 'bg-emerald-500/10 text-emerald-600',
  }[tone];

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start justify-between gap-2.5 p-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">
            {value}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {hint}
          </p>
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            toneClasses,
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function OrderStatusTab({
  data,
  isLoading,
  error,
  periodMode,
  searchInput,
  onSearchInputChange,
  statusFilter,
  onStatusFilterChange,
  agentFilter,
  onAgentFilterChange,
  ageingRange,
  onAgeingRangeChange,
  overdueDays,
  onOverdueDaysChange,
  onPageChange,
  canConfigureOverdue,
  onRetry,
}: {
  data: OrderStatusDashboardResponse | null;
  isLoading: boolean;
  error: string | null;
  periodMode: 'all' | 'month';
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  agentFilter: string;
  onAgentFilterChange: (value: string) => void;
  ageingRange: OrderStatusAgeingRange;
  onAgeingRangeChange: (value: OrderStatusAgeingRange) => void;
  overdueDays: number;
  onOverdueDaysChange: (value: number) => void;
  onPageChange: (page: number) => void;
  canConfigureOverdue: boolean;
  onRetry: () => void;
}) {
  const [sortState, setSortState] = useState<OrderStatusSortState>({
    key: 'ageingDays',
    direction: 'desc',
  });
  const sortedOrders = useMemo(() => {
    const orders = [...(data?.orders ?? [])];

    orders.sort((first, second) => {
      const direction = sortState.direction === 'asc' ? 1 : -1;

      if (sortState.key === 'ageingDays') {
        return (first.ageingDays - second.ageingDays) * direction;
      }

      if (sortState.key === 'saleDate') {
        return (
          (new Date(first.saleDate).getTime() -
            new Date(second.saleDate).getTime()) *
          direction
        );
      }

      return (
        String(first[sortState.key]).localeCompare(
          String(second[sortState.key]),
          undefined,
          { sensitivity: 'base' },
        ) * direction
      );
    });

    return orders;
  }, [data?.orders, sortState]);

  const handleSort = (key: OrderStatusSortKey) => {
    setSortState((currentState) => ({
      key,
      direction:
        currentState.key === key && currentState.direction === 'desc'
          ? 'asc'
          : 'desc',
    }));
  };

  if (isLoading && !data) {
    return <OrderStatusSkeleton />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <PackageCheck className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">
              Order status dashboard is unavailable
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error ?? 'Unable to load order status analytics right now.'}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const startItem =
    data.meta.total === 0 ? 0 : (data.meta.page - 1) * data.meta.limit + 1;
  const endItem = Math.min(data.meta.page * data.meta.limit, data.meta.total);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SalesKpiCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Pending Orders"
          value={data.totals.pendingOrders.toLocaleString()}
          hint="Still in fulfilment workflow"
          tone="blue"
        />
        <SalesKpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Average Ageing"
          value={`${data.totals.averageAgeing.toLocaleString()} days`}
          hint="Average age for pending orders"
          tone="orange"
        />
        <SalesKpiCard
          icon={<PackageCheck className="h-5 w-5" />}
          label={periodMode === 'all' ? 'Delivered' : 'Delivered MTD'}
          value={data.totals.deliveredMtd.toLocaleString()}
          hint="Delivered orders in current period"
          tone="emerald"
        />
        <SalesKpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Overdue Orders"
          value={data.totals.overdueOrders.toLocaleString()}
          hint={`Ageing greater than ${data.overdueDays} days`}
          tone="violet"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-secondary/30 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Order Status</CardTitle>
              <p className="text-sm text-muted-foreground">
                {data.periodLabel} · {data.meta.total.toLocaleString()} matching orders
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isLoading ? (
                <Badge variant="outline" className="bg-card">
                  Updating...
                </Badge>
              ) : null}
              <Badge variant="outline" className="bg-card">
                Overdue &gt; {data.overdueDays} days
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-2 xl:grid-cols-[1.3fr_0.85fr_0.85fr_0.75fr_0.6fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => onSearchInputChange(event.target.value)}
                placeholder="Search order, sale no., or customer"
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value)}
              className="h-10 rounded-xl"
            >
              <option value="ALL">All statuses</option>
              {data.statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatDashboardStatus(status)}
                </option>
              ))}
            </Select>
            <Select
              value={agentFilter}
              onChange={(event) => onAgentFilterChange(event.target.value)}
              className="h-10 rounded-xl"
            >
              <option value="ALL">All agents</option>
              {data.agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
            <Select
              value={ageingRange}
              onChange={(event) =>
                onAgeingRangeChange(event.target.value as OrderStatusAgeingRange)
              }
              className="h-10 rounded-xl"
            >
              <option value="ALL">All ageing</option>
              <option value="0-7">0-7 days</option>
              <option value="8-14">8-14 days</option>
              <option value="15-30">15-30 days</option>
              <option value="31+">31+ days</option>
            </Select>
            <Input
              type="number"
              min={1}
              value={overdueDays}
              disabled={!canConfigureOverdue}
              title={
                canConfigureOverdue
                  ? 'Admin can configure the overdue threshold.'
                  : 'Only Admin can configure overdue threshold.'
              }
              onChange={(event) =>
                onOverdueDaysChange(Math.max(1, Number(event.target.value) || 14))
              }
              className="h-10 rounded-xl"
            />
          </div>

          {sortedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold text-foreground">No matching orders</p>
              <p className="text-sm text-muted-foreground">
                Try changing the search, status, agent, ageing, or period filter.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                'overflow-x-auto rounded-2xl border border-border/70 transition-opacity',
                isLoading ? 'opacity-70' : 'opacity-100',
              )}
            >
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <OrderSortableHeader
                      label="Sale"
                      sortKey="salesNumber"
                      activeSort={sortState}
                      onSort={handleSort}
                      align="left"
                    />
                    <OrderSortableHeader
                      label="Customer"
                      sortKey="customerName"
                      activeSort={sortState}
                      onSort={handleSort}
                      align="left"
                    />
                    <OrderSortableHeader
                      label="Agent"
                      sortKey="agentName"
                      activeSort={sortState}
                      onSort={handleSort}
                      align="left"
                    />
                    <OrderSortableHeader
                      label="Sale Date"
                      sortKey="saleDate"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                    <OrderSortableHeader
                      label="Ageing"
                      sortKey="ageingDays"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                    <OrderSortableHeader
                      label="Status"
                      sortKey="status"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order) => (
                    <OrderStatusRow key={order.id} order={order} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of{' '}
              {data.meta.total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!data.meta.hasPreviousPage || isLoading}
                onClick={() => onPageChange(Math.max(data.meta.page - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="min-w-24 text-center text-sm text-muted-foreground">
                Page {data.meta.totalPages === 0 ? 0 : data.meta.page} of{' '}
                {data.meta.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!data.meta.hasNextPage || isLoading}
                onClick={() => onPageChange(data.meta.page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OrderSortableHeader({
  label,
  sortKey,
  activeSort,
  onSort,
  align = 'right',
}: {
  label: string;
  sortKey: OrderStatusSortKey;
  activeSort: OrderStatusSortState;
  onSort: (key: OrderStatusSortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = activeSort.key === sortKey;
  const SortIcon = activeSort.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th className={cn('px-4 py-3', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-1 py-1 transition hover:text-foreground',
          align === 'right' ? 'justify-end' : 'justify-start',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        {isActive ? <SortIcon className="h-3.5 w-3.5" /> : null}
      </button>
    </th>
  );
}

function OrderStatusRow({ order }: { order: OrderStatusDashboardOrder }) {
  const saleLabel = order.salesNumber || 'No sale number';

  return (
    <tr className="border-t border-border/70 transition hover:bg-secondary/35">
      <td className="px-4 py-3">
        <Link
          href={`/orders/${order.id}`}
          className="font-semibold text-primary hover:underline"
        >
          {saleLabel}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {order.orderNumber}
        </p>
      </td>
      <td className="max-w-[240px] px-4 py-3">
        <p className="truncate font-medium text-foreground">
          {order.customerName}
        </p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {order.agentInitials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {order.agentName}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-muted-foreground">
        {formatDate(order.saleDate)}
      </td>
      <td
        className={cn(
          'px-4 py-3 text-right font-semibold',
          order.isOverdue ? 'text-destructive' : 'text-foreground',
        )}
      >
        {order.ageingDays.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right">
        <ShipmentStatusBadge status={order.status} />
      </td>
    </tr>
  );
}

function AgentLeadsTab({
  data,
  isLoading,
  error,
  searchInput,
  onSearchInputChange,
  statusFilter,
  onStatusFilterChange,
  onRetry,
}: {
  data: AgentLeadsDashboardResponse | null;
  isLoading: boolean;
  error: string | null;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onRetry: () => void;
}) {
  const [sortState, setSortState] = useState<AgentLeadsSortState>({
    key: 'totalLeads',
    direction: 'desc',
  });
  const sortedAgents = useMemo(() => {
    const agents = [...(data?.agents ?? [])];

    agents.sort((first, second) => {
      const direction = sortState.direction === 'asc' ? 1 : -1;

      if (sortState.key === 'lastUpdated') {
        const firstTime = first.lastUpdated
          ? new Date(first.lastUpdated).getTime()
          : 0;
        const secondTime = second.lastUpdated
          ? new Date(second.lastUpdated).getTime()
          : 0;

        return (firstTime - secondTime) * direction;
      }

      if (
        sortState.key === 'totalLeads' ||
        sortState.key === 'totalProspects'
      ) {
        return (first[sortState.key] - second[sortState.key]) * direction;
      }

      return (
        first.agentName.localeCompare(second.agentName, undefined, {
          sensitivity: 'base',
        }) * direction
      );
    });

    return agents;
  }, [data?.agents, sortState]);

  const handleSort = (key: AgentLeadsSortKey) => {
    setSortState((currentState) => ({
      key,
      direction:
        currentState.key === key && currentState.direction === 'desc'
          ? 'asc'
          : 'desc',
    }));
  };

  if (isLoading && !data) {
    return <AgentLeadsSkeleton />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <Users className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">
              Agent leads dashboard is unavailable
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error ?? 'Unable to load agent lead statistics right now.'}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <SalesKpiCard
          icon={<Users className="h-5 w-5" />}
          label="Total Leads"
          value={data.totals.totalLeads.toLocaleString()}
          hint={`Assigned leads for ${data.periodLabel}`}
          tone="blue"
        />
        <SalesKpiCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Total Prospects"
          value={data.totals.totalProspects.toLocaleString()}
          hint="Leads currently marked as Prospect"
          tone="emerald"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-secondary/30 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Agent Leads</CardTitle>
              <p className="text-sm text-muted-foreground">
                {data.periodLabel} · {data.agents.length.toLocaleString()} agents
              </p>
            </div>
            {isLoading ? (
              <Badge variant="outline" className="bg-card">
                Updating...
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-2 lg:grid-cols-[1fr_260px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => onSearchInputChange(event.target.value)}
                placeholder="Search agent name"
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value)}
              className="h-10 rounded-xl"
            >
              <option value="ALL">All lead statuses</option>
              {data.statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatLeadStatusLabel(status)}
                </option>
              ))}
            </Select>
          </div>

          {sortedAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold text-foreground">No matching agents</p>
              <p className="text-sm text-muted-foreground">
                Try another month, agent search, or lead status.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                'overflow-x-auto rounded-2xl border border-border/70 transition-opacity',
                isLoading ? 'opacity-70' : 'opacity-100',
              )}
            >
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <AgentLeadsSortableHeader
                      label="Agent"
                      sortKey="agentName"
                      activeSort={sortState}
                      onSort={handleSort}
                      align="left"
                    />
                    <AgentLeadsSortableHeader
                      label="Total Leads"
                      sortKey="totalLeads"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                    <AgentLeadsSortableHeader
                      label="Total Prospects"
                      sortKey="totalProspects"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                    <AgentLeadsSortableHeader
                      label="Last Updated"
                      sortKey="lastUpdated"
                      activeSort={sortState}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent) => (
                    <AgentLeadsRow key={agent.agentId} agent={agent} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentLeadsSortableHeader({
  label,
  sortKey,
  activeSort,
  onSort,
  align = 'right',
}: {
  label: string;
  sortKey: AgentLeadsSortKey;
  activeSort: AgentLeadsSortState;
  onSort: (key: AgentLeadsSortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = activeSort.key === sortKey;
  const SortIcon = activeSort.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th className={cn('px-4 py-3', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-1 py-1 transition hover:text-foreground',
          align === 'right' ? 'justify-end' : 'justify-start',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        {isActive ? <SortIcon className="h-3.5 w-3.5" /> : null}
      </button>
    </th>
  );
}

function AgentLeadsRow({ agent }: { agent: AgentLeadsDashboardAgent }) {
  return (
    <tr className="border-t border-border/70 transition hover:bg-secondary/35">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {agent.initials}
          </span>
          <p className="truncate font-medium text-foreground">
            {agent.agentName}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-semibold text-foreground">
        {agent.totalLeads.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-foreground">
        {agent.totalProspects.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right text-muted-foreground">
        {agent.lastUpdated ? formatDateTime(agent.lastUpdated) : 'No updates'}
      </td>
    </tr>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeSort,
  onSort,
  align = 'right',
}: {
  label: string;
  sortKey: SalesOverviewSortKey;
  activeSort: SortState;
  onSort: (key: SalesOverviewSortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = activeSort.key === sortKey;
  const SortIcon =
    activeSort.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th className={cn('px-4 py-3', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-1 py-1 transition hover:text-foreground',
          align === 'right' ? 'justify-end' : 'justify-start',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        {isActive ? <SortIcon className="h-3.5 w-3.5" /> : null}
      </button>
    </th>
  );
}

function AgentPerformanceRow({
  agent,
  currency,
}: {
  agent: SalesOverviewAgent;
  currency: string;
}) {
  return (
    <tr className="border-t border-border/70 transition hover:bg-secondary/35">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-orange-500/15 text-xs font-bold text-primary ring-1 ring-primary/15">
            {agent.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {agent.agentName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {agent.agentEmail || formatRole(agent.role)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-medium">
        {agent.totalCalls.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right font-medium">
        {agent.totalSales.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right font-medium">
        {formatDashboardCurrency(agent.totalCharging, currency)}
      </td>
      <td
        className={cn(
          'px-4 py-3 text-right font-semibold',
          agent.grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive',
        )}
      >
        {formatDashboardCurrency(agent.grossProfit, currency)}
      </td>
    </tr>
  );
}

function SalesOverviewSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-[420px]" />
    </div>
  );
}

function OrderStatusSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-[460px]" />
    </div>
  );
}

function AgentLeadsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-2xl" />
    </div>
  );
}

function formatDashboardCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDashboardStatus(status: OrderStatusDashboardStatus) {
  const labels: Record<OrderStatusDashboardStatus, string> = {
    PENDING: 'Pending',
    LOCATING: 'Locating',
    PRE_PROCESSING: 'Pre Processing',
    PURCHASE: 'Purchase',
    SHIPPED: 'Shipped',
    IN_TRANSIT: 'In Transit',
    DISPUTED: 'Disputed',
    DELIVERED: 'Delivered',
    DELAYED: 'Delayed',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
  };

  return labels[status];
}

function formatRole(role: SalesOverviewAgent['role']) {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
