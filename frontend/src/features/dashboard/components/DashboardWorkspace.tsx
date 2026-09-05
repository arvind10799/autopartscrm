'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  ClipboardList,
  DollarSign,
  PhoneCall,
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
import { cn } from '@/lib/utils/cn';
import { getPacificTodayDateInputValue } from '@/lib/utils/pacific-date';
import { dashboardApi } from '../api/dashboard-api';
import type {
  DashboardTab,
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

type SortState = {
  key: SalesOverviewSortKey;
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
  const maxMonth = getPacificTodayDateInputValue().slice(0, 7);

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
              onChange={(event) =>
                setPeriodMode(event.target.value === 'all' ? 'all' : 'month')
              }
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
                onChange={(event) =>
                  setSelectedMonth(event.target.value || maxMonth)
                }
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
      ) : (
        <PlaceholderTab
          title={
            activeTab === 'order-status' ? 'Order Status' : 'Agent Leads'
          }
          description={
            activeTab === 'order-status'
              ? 'This tab will show order status breakdowns, aging, and workflow movement.'
              : 'This tab will show agent-level lead lists, follow-ups, and conversion quality.'
          }
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">
            {value}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
            toneClasses,
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
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

function PlaceholderTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BarChart3 className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <Badge variant="outline">Coming soon</Badge>
      </CardContent>
    </Card>
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

function formatDashboardCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRole(role: SalesOverviewAgent['role']) {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
