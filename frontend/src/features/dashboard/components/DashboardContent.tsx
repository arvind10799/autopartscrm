'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  DollarSign,
  FileText,
  PackageCheck,
  PlusCircle,
  Target,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { DashboardMetricCard } from '@/components/app-shell/DashboardMetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { leadsApi } from '@/features/leads/api/leads-api';
import { formatLeadStatusLabel } from '@/features/leads/lib/leads.helpers';
import {
  buildTimestampRangeQuery,
  createDefaultDateRangeFilterState,
} from '@/lib/filters/date-range';
import {
  formatPacificShortDateTime,
  getPacificTodayDateInputValue,
} from '@/lib/utils/pacific-date';
import { ordersApi } from '@/features/orders/api/orders-api';
import { shipmentsApi } from '@/features/shipments/api/shipments-api';
import type { OrderSummary } from '@/features/orders/types/order.types';
import type { LeadStatus, LeadSummary } from '@/features/leads/types/lead.types';
import type { ShipmentSummary } from '@/features/shipments/types/shipment.types';
import type { UserRole } from '@/features/auth/types/auth.types';

const DASHBOARD_PAGE_SIZE = 100;
const OPEN_LEAD_STATUSES = new Set<LeadStatus>([
  'PROSPECT',
  'QUOTED',
  'CALL_BACK_LATER',
  'SHOPPING_AROUND',
  'NEEDS_LOCALLY',
  'WE_DONT_SALE',
]);
const FOLLOW_UP_STATUSES = new Set<LeadStatus>([
  'QUOTED',
  'CALL_BACK_LATER',
  'SHOPPING_AROUND',
]);
const PAID_ORDER_STATUSES = new Set<string>([
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
]);
const ACTIVE_SHIPMENT_STATUSES = new Set([
  'PENDING',
  'IN_TRANSIT',
  'DELAYED',
]);
const PIPELINE_STATUSES: LeadStatus[] = [
  'PROSPECT',
  'QUOTED',
  'CALL_BACK_LATER',
  'SHOPPING_AROUND',
  'NOT_INTERESTED',
  'NEEDS_LOCALLY',
  'WE_DONT_SALE',
];

interface DashboardData {
  leads: LeadSummary[];
  leadTotal: number;
  visibleQuotedValue: number;
  orders: OrderSummary[];
  orderTotal: number;
  visibleRevenue: number;
  shipments: ShipmentSummary[];
  shipmentTotal: number;
}

function computeMetrics(data: DashboardData, role: UserRole) {
  const {
    leads,
    leadTotal,
    visibleQuotedValue,
    orders,
    orderTotal,
    visibleRevenue,
    shipments,
    shipmentTotal,
  } = data;

  const draftOrders = orders.filter((o) => o.status === 'DRAFT').length;
  const partiallyPaidOrders = orders.filter(
    (o) => o.status === 'PARTIALLY_PAID',
  ).length;
  const confirmedOrders = orders.filter((o) => o.status === 'CONFIRMED').length;
  const inTransit = shipments.filter((s) => s.currentStatus === 'IN_TRANSIT').length;
  const delivered = shipments.filter((s) => s.currentStatus === 'DELIVERED').length;
  const delayed = shipments.filter((s) => s.currentStatus === 'DELAYED').length;
  const pending = shipments.filter((s) => s.currentStatus === 'PENDING').length;
  const openLeads = leads.filter(
    (lead) => !lead.isConverted && lead.status !== 'NOT_INTERESTED',
  ).length;

  if (role === 'SALES') {
    return [
      { label: 'Total Leads', value: leadTotal.toLocaleString(), hint: 'Assigned leads visible to you' },
      { label: 'Open Leads', value: openLeads.toLocaleString(), hint: 'Excludes converted and not interested leads' },
      { label: 'Visible Quoted Value', value: formatDashboardCurrency(visibleQuotedValue), hint: 'Quoted lead value for the current filters' },
      { label: 'Visible Revenue', value: formatDashboardCurrency(visibleRevenue), hint: 'Order revenue for the current filters' },
    ];
  }

  if (role === 'SHIPPING') {
    return [
      { label: 'Total Shipments', value: String(shipmentTotal), hint: `${pending} pending pickup` },
      { label: 'In Transit', value: String(inTransit), hint: `${delayed} delayed` },
      { label: 'Delivered', value: String(delivered), hint: 'Completed deliveries' },
      { label: 'Confirmed Orders', value: String(confirmedOrders), hint: 'Ready for shipment' },
    ];
  }

  // ADMIN
  return [
    { label: 'Orders', value: String(orderTotal), hint: `${draftOrders} drafts, ${partiallyPaidOrders} partially paid` },
    { label: 'Shipments', value: String(shipmentTotal), hint: `${pending} pending, ${inTransit} in transit` },
    { label: 'Delivered', value: String(delivered), hint: `${delayed} delayed` },
    { label: 'Revenue', value: formatDashboardCurrency(visibleRevenue), hint: `Across ${orderTotal} orders` },
  ];
}

async function loadVisibleOrders(createdFrom?: string, createdTo?: string) {
  const firstPage = await ordersApi.list({
    page: 1,
    limit: DASHBOARD_PAGE_SIZE,
    createdFrom,
    createdTo,
  });
  const items = [...firstPage.items];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const pageResponse = await ordersApi.list({
      page,
      limit: DASHBOARD_PAGE_SIZE,
      createdFrom,
      createdTo,
    });
    items.push(...pageResponse.items);
  }

  return {
    items,
    total: firstPage.meta.total,
  };
}

async function loadVisibleLeads(createdFrom?: string, createdTo?: string) {
  const firstPage = await leadsApi.list({
    page: 1,
    limit: DASHBOARD_PAGE_SIZE,
    createdFrom,
    createdTo,
  });
  const items = [...firstPage.items];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const pageResponse = await leadsApi.list({
      page,
      limit: DASHBOARD_PAGE_SIZE,
      createdFrom,
      createdTo,
    });
    items.push(...pageResponse.items);
  }

  return {
    items,
    total: firstPage.meta.total,
  };
}

function formatDashboardCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatShortDate(value: string) {
  return formatPacificShortDateTime(value);
}

function isToday(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return getDayKey(date) === getPacificTodayDateInputValue();
}

function getDayKey(date: Date) {
  return getPacificTodayDateInputValue(date);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function safePercentage(value: number, total: number) {
  return total > 0 ? Math.min(100, (value / total) * 100) : 0;
}

function formatOrderStatusLabel(status: OrderSummary['status']) {
  return status
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function buildSalesDashboardInsights(data: DashboardData) {
  const visibleOrderIds = new Set(data.orders.map((order) => order.id));
  const salesShipments = data.shipments.filter((shipment) =>
    visibleOrderIds.has(shipment.orderId),
  );
  const openLeads = data.leads.filter(
    (lead) => !lead.isConverted && OPEN_LEAD_STATUSES.has(lead.status),
  );
  const todayLeads = data.leads.filter((lead) =>
    isToday(lead.date ?? lead.createdAt),
  );
  const ordersToday = data.orders.filter((order) => isToday(order.createdAt));
  const followUpLeads = data.leads
    .filter((lead) => !lead.isConverted && FOLLOW_UP_STATUSES.has(lead.status))
    .sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
    )
    .slice(0, 5);
  const pendingShipments = salesShipments.filter((shipment) =>
    ACTIVE_SHIPMENT_STATUSES.has(shipment.currentStatus),
  );
  const delayedShipments = salesShipments.filter(
    (shipment) => shipment.currentStatus === 'DELAYED',
  );
  const paidRevenue = data.orders
    .filter((order) => PAID_ORDER_STATUSES.has(order.status))
    .reduce((sum, order) => sum + order.totalSaleAmount, 0);
  const partiallyPaidValue = data.orders
    .filter((order) => order.status === 'PARTIALLY_PAID')
    .reduce((sum, order) => sum + order.totalSaleAmount, 0);
  const outstandingBalance = data.orders
    .filter((order) => order.status === 'PARTIALLY_PAID')
    .reduce(
      (sum, order) =>
        sum +
        Math.max(
          order.totalSaleAmount - (order.intakeDetails?.partialPayment ?? 0),
          0,
        ),
      0,
    );
  const pipeline = PIPELINE_STATUSES.map((status) => ({
    status,
    label: formatLeadStatusLabel(status),
    count: data.leads.filter((lead) => lead.status === status).length,
  }));
  const convertedLeads = data.leads.filter((lead) => lead.isConverted).length;
  const conversionRate = safePercentage(convertedLeads, data.leads.length);
  const quotedLeads = data.leads.filter((lead) => lead.status === 'QUOTED');
  const quotedPaidLeads = quotedLeads.filter((lead) =>
    lead.convertedOrder ? PAID_ORDER_STATUSES.has(lead.convertedOrder.status) : false,
  ).length;
  const quotedPaidRate = safePercentage(quotedPaidLeads, quotedLeads.length);
  const recentActivity = [
    ...data.leads.map((lead) => ({
      id: `lead-${lead.id}`,
      badge: 'Lead',
      title: formatLeadStatusLabel(lead.status),
      subtitle: lead.customerName,
      at: lead.updatedAt,
      href: '/leads',
      variant: 'info' as const,
    })),
    ...data.orders.map((order) => ({
      id: `order-${order.id}`,
      badge: 'Order',
      title: `${order.orderNumber} ${formatOrderStatusLabel(order.status)}`,
      subtitle: order.customerName,
      at: order.updatedAt,
      href: `/orders/${order.id}`,
      variant: 'success' as const,
    })),
    ...data.orders
      .filter((order) => order.latestNote)
      .map((order) => ({
        id: `note-${order.latestNote?.id ?? order.id}`,
        badge: 'Note',
        title: 'Order note updated',
        subtitle: order.latestNote?.content ?? order.orderNumber,
        at: order.latestNote?.createdAt ?? order.updatedAt,
        href: `/orders/${order.id}`,
        variant: 'warning' as const,
      })),
    ...salesShipments.map((shipment) => ({
      id: `shipment-${shipment.id}`,
      badge: 'Shipment',
      title: shipment.currentStatus.replace(/_/g, ' '),
      subtitle: `${shipment.order.orderNumber} · ${shipment.carrierName ?? 'Carrier pending'}`,
      at: shipment.updatedAt,
      href: `/shipments/${shipment.id}`,
      variant: shipment.currentStatus === 'DELAYED' ? 'danger' as const : 'neutral' as const,
    })),
  ]
    .sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime())
    .slice(0, 8);
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = getDayKey(date);
    const dayLeads = data.leads.filter(
      (lead) => getDayKey(new Date(lead.date ?? lead.createdAt)) === key,
    ).length;
    const dayOrders = data.orders.filter(
      (order) => getDayKey(new Date(order.createdAt)) === key,
    );

    return {
      key,
      label: new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        weekday: 'short',
      }).format(date),
      leads: dayLeads,
      orders: dayOrders.length,
      revenue: dayOrders.reduce((sum, order) => sum + order.totalSaleAmount, 0),
    };
  });

  return {
    openLeads,
    todayLeads,
    ordersToday,
    followUpLeads,
    pendingShipments,
    delayedShipments,
    paidRevenue,
    partiallyPaidValue,
    outstandingBalance,
    pipeline,
    conversionRate,
    quotedPaidRate,
    recentActivity,
    trend,
  };
}

export function DashboardContent() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'SALES';
  const [dateFilter, setDateFilter] = useState(
    createDefaultDateRangeFilterState(),
  );
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [leadsRes, ordersRes, shipmentsRes] = await Promise.all([
          loadVisibleLeads(
            dateRangeQuery.createdFrom,
            dateRangeQuery.createdTo,
          ).catch(() => ({ items: [] as LeadSummary[], total: 0 })),
          loadVisibleOrders(
            dateRangeQuery.createdFrom,
            dateRangeQuery.createdTo,
          ).catch(() => ({ items: [] as OrderSummary[], total: 0 })),
          shipmentsApi
            .list({
              page: 1,
              limit: DASHBOARD_PAGE_SIZE,
              createdFrom: dateRangeQuery.createdFrom,
              createdTo: dateRangeQuery.createdTo,
            })
            .catch(() => ({ items: [] as ShipmentSummary[], meta: { total: 0 } })),
        ]);

        if (cancelled) return;
        setData({
          leads: leadsRes.items,
          leadTotal: leadsRes.total,
          visibleQuotedValue: leadsRes.items.reduce(
            (sum, lead) => sum + (lead.quote ?? 0),
            0,
          ),
          orders: ordersRes.items,
          orderTotal: ordersRes.total,
          visibleRevenue: ordersRes.items.reduce(
            (sum, order) => sum + order.totalSaleAmount,
            0,
          ),
          shipments: shipmentsRes.items,
          shipmentTotal: shipmentsRes.meta.total,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [dateRangeQuery.createdFrom, dateRangeQuery.createdTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading dashboard...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error ?? 'Failed to load data.'}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (role === 'SALES') {
    return (
      <SalesDashboardContent
        data={data}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        userName={user?.name ?? 'Sales User'}
      />
    );
  }

  const metrics = computeMetrics(data, role);
  const recentShipments = data.shipments.slice(0, 5);

  return (
    <section className="space-y-6">
      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* Metrics */}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Operational metrics">
        {metrics.map((metric) => (
          <li key={metric.label} className="list-none">
            <DashboardMetricCard {...metric} />
          </li>
        ))}
      </ul>

      {(role === 'ADMIN' || role === 'SHIPPING') && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Recent Shipments
              </CardTitle>
              <Link href="/shipments">
                <Button variant="ghost" size="sm" className="text-xs">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {recentShipments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No shipments yet.</p>
              ) : (
                recentShipments.map((shipment) => (
                  <Link
                    key={shipment.id}
                    href={`/shipments/${shipment.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-3 transition hover:bg-secondary/70"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {shipment.proNumber ?? 'PRO pending'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {shipment.order.customerName} · {shipment.order.orderNumber}
                      </p>
                    </div>
                    <ShipmentStatusBadge status={shipment.currentStatus} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

function SalesDashboardContent({
  data,
  dateFilter,
  onDateFilterChange,
  userName,
}: {
  data: DashboardData;
  dateFilter: ReturnType<typeof createDefaultDateRangeFilterState>;
  onDateFilterChange: (value: ReturnType<typeof createDefaultDateRangeFilterState>) => void;
  userName: string;
}) {
  const insights = buildSalesDashboardInsights(data);
  const topPipelineCount = Math.max(
    1,
    ...insights.pipeline.map((item) => item.count),
  );

  return (
    <section className="space-y-6">
      <Card className="overflow-hidden border-primary/15 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_32%),linear-gradient(135deg,_#ffffff,_#eef6ff_55%,_#f8fbff)] shadow-xl dark:bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.18),_transparent_34%),linear-gradient(135deg,_hsl(var(--card)),_hsl(var(--secondary))_58%,_hsl(var(--card)))]">
        <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary shadow-sm">
              <Target className="h-3.5 w-3.5" />
              Sales Command Center
            </div>
            <div className="max-w-2xl space-y-2">
              <h2 className="font-[var(--font-heading)] text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
                Good day, {userName.split(' ')[0] || 'there'}.
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Your dashboard now highlights pipeline health, priority follow-ups,
                shipment alerts, and revenue signals in one focused workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/leads">
                <Button size="sm" className="rounded-full">
                  <PlusCircle className="h-4 w-4" />
                  Create Lead
                </Button>
              </Link>
              <Link href="/orders">
                <Button size="sm" variant="outline" className="rounded-full bg-card/80">
                  <FileText className="h-4 w-4" />
                  Create Order
                </Button>
              </Link>
              <Link href="/leads?converted=false">
                <Button size="sm" variant="ghost" className="rounded-full bg-card/60">
                  View Open Leads
                </Button>
              </Link>
              <Link href="/orders">
                <Button size="sm" variant="ghost" className="rounded-full bg-card/60">
                  View My Orders
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              Dashboard Date Filter
            </div>
            <DateRangeFilter
              value={dateFilter}
              onChange={onDateFilterChange}
              variant="inline"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MiniMetric
                label="Visible Quoted"
                value={formatDashboardCurrency(data.visibleQuotedValue)}
              />
              <MiniMetric
                label="Visible Revenue"
                value={formatDashboardCurrency(data.visibleRevenue)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FocusStatCard
          icon={<Users className="h-5 w-5" />}
          label="New Leads Today"
          value={insights.todayLeads.length.toLocaleString()}
          tone="blue"
          hint={`${data.leadTotal.toLocaleString()} total assigned leads`}
        />
        <FocusStatCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Open Follow-ups"
          value={insights.followUpLeads.length.toLocaleString()}
          tone="amber"
          hint="Quoted, callback, and shopping around leads"
        />
        <FocusStatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Orders Created Today"
          value={insights.ordersToday.length.toLocaleString()}
          tone="emerald"
          hint={`${data.orderTotal.toLocaleString()} orders in current view`}
        />
        <FocusStatCard
          icon={<Truck className="h-5 w-5" />}
          label="Pending Shipments"
          value={insights.pendingShipments.length.toLocaleString()}
          tone="violet"
          hint={`${insights.delayedShipments.length} delayed shipments need attention`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              Lead Pipeline
            </CardTitle>
            <Badge variant="info">{insights.openLeads.length} open</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.pipeline.map((item) => (
              <div key={item.status} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400"
                    style={{ width: `${safePercentage(item.count, topPipelineCount)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <RevenueSnapshotCard
            icon={<CircleDollarSign className="h-5 w-5" />}
            label="Paid Revenue"
            value={formatDashboardCurrency(insights.paidRevenue)}
            hint="Paid or active fulfilled order statuses"
            tone="emerald"
          />
          <RevenueSnapshotCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Partially Paid Value"
            value={formatDashboardCurrency(insights.partiallyPaidValue)}
            hint="Total sale value for partial orders"
            tone="amber"
          />
          <RevenueSnapshotCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Outstanding Balance"
            value={formatDashboardCurrency(insights.outstandingBalance)}
            hint="Remaining balance from partial payments"
            tone="rose"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Conversion Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ConversionMeter
              label="Leads to Orders"
              value={insights.conversionRate}
              hint={`${data.leads.filter((lead) => lead.isConverted).length} converted from ${data.leads.length}`}
            />
            <ConversionMeter
              label="Quoted to Paid"
              value={insights.quotedPaidRate}
              hint="Quoted leads that reached paid order flow"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              7-Day Performance
            </CardTitle>
            <Badge variant="neutral">{formatCompactCurrency(data.visibleRevenue)}</Badge>
          </CardHeader>
          <CardContent>
            <TrendBars trend={insights.trend} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <PriorityList leads={insights.followUpLeads} />
        <RecentActivityTimeline activities={insights.recentActivity} />
        <ShipmentAlerts shipments={insights.pendingShipments.slice(0, 5)} />
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-secondary/60 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">
        {value}
      </p>
    </div>
  );
}

function FocusStatCard({
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
  tone: 'blue' | 'amber' | 'emerald' | 'violet';
}) {
  const tones = {
    blue: 'from-blue-500/14 to-cyan-400/10 text-blue-700 ring-blue-100 dark:text-blue-300 dark:ring-blue-500/20',
    amber: 'from-amber-500/16 to-orange-400/10 text-amber-700 ring-amber-100 dark:text-amber-300 dark:ring-amber-500/20',
    emerald: 'from-emerald-500/16 to-teal-400/10 text-emerald-700 ring-emerald-100 dark:text-emerald-300 dark:ring-emerald-500/20',
    violet: 'from-violet-500/16 to-fuchsia-400/10 text-violet-700 ring-violet-100 dark:text-violet-300 dark:ring-violet-500/20',
  };

  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              {value}
            </p>
          </div>
          <div className={`rounded-2xl bg-gradient-to-br p-3 ring-1 ${tones[tone]}`}>
            {icon}
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function RevenueSnapshotCard({
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
  tone: 'emerald' | 'amber' | 'rose';
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  };

  return (
    <Card className="bg-card/95 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-2xl p-3 ring-1 ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-[-0.04em] text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ConversionMeter({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/45 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <Badge variant="success">{formatPercent(value)}</Badge>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}

function TrendBars({
  trend,
}: {
  trend: Array<{ key: string; label: string; leads: number; orders: number; revenue: number }>;
}) {
  const maxValue = Math.max(
    1,
    ...trend.map((item) => item.leads + item.orders + Math.ceil(item.revenue / 1000)),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Leads
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Orders
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Revenue
        </span>
      </div>
      <div className="grid h-44 grid-cols-7 items-end gap-3">
        {trend.map((item) => {
          const leadHeight = Math.max(8, safePercentage(item.leads, maxValue));
          const orderHeight = Math.max(8, safePercentage(item.orders, maxValue));
          const revenueHeight = Math.max(8, safePercentage(Math.ceil(item.revenue / 1000), maxValue));

          return (
            <div key={item.key} className="flex h-full flex-col justify-end gap-2">
              <div className="flex h-32 items-end justify-center gap-1 rounded-xl bg-secondary/60 px-2 py-2">
                <span
                  className="w-2 rounded-full bg-primary"
                  style={{ height: `${leadHeight}%` }}
                  title={`${item.leads} leads`}
                />
                <span
                  className="w-2 rounded-full bg-emerald-500"
                  style={{ height: `${orderHeight}%` }}
                  title={`${item.orders} orders`}
                />
                <span
                  className="w-2 rounded-full bg-amber-500"
                  style={{ height: `${revenueHeight}%` }}
                  title={`${formatDashboardCurrency(item.revenue)} revenue`}
                />
              </div>
              <span className="text-center text-[11px] font-medium text-muted-foreground">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriorityList({ leads }: { leads: LeadSummary[] }) {
  return (
    <Card className="xl:col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" />
          Follow-up Priority
        </CardTitle>
        <Link href="/leads?converted=false">
          <Button variant="ghost" size="sm" className="text-xs">
            View leads <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {leads.length === 0 ? (
          <EmptyPanel message="No urgent follow-ups right now." />
        ) : (
          leads.map((lead) => (
            <Link
              key={lead.id}
              href="/leads"
              className="block rounded-xl border border-border/70 bg-card px-4 py-3 transition hover:border-primary/25 hover:bg-secondary/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {lead.customerName}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {lead.vehicleYear} {lead.vehicleMake} {lead.vehicleModel}
                  </p>
                </div>
                <Badge variant={lead.status === 'QUOTED' ? 'success' : 'warning'}>
                  {formatLeadStatusLabel(lead.status)}
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{lead.customerPhone}</span>
                <span>{formatDashboardCurrency(lead.quote ?? 0)}</span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityTimeline({
  activities,
}: {
  activities: Array<{
    id: string;
    badge: string;
    title: string;
    subtitle: string;
    at: string;
    href: string;
    variant: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  }>;
}) {
  return (
    <Card className="xl:col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {activities.length === 0 ? (
          <EmptyPanel message="Activity will appear here as work moves." />
        ) : (
          activities.map((activity) => (
            <Link
              key={activity.id}
              href={activity.href}
              className="group grid grid-cols-[auto_1fr] gap-3 rounded-xl px-2 py-3 transition hover:bg-secondary/70"
            >
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_4px_rgba(37,99,235,0.12)]" />
              <span className="min-w-0">
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {activity.title}
                  </span>
                  <Badge variant={activity.variant} className="shrink-0 text-[10px]">
                    {activity.badge}
                  </Badge>
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {activity.subtitle}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {formatShortDate(activity.at)}
                </span>
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ShipmentAlerts({ shipments }: { shipments: ShipmentSummary[] }) {
  return (
    <Card className="xl:col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="h-4 w-4 text-primary" />
          Shipment Alerts
        </CardTitle>
        <Link href="/shipments">
          <Button variant="ghost" size="sm" className="text-xs">
            Workspace <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {shipments.length === 0 ? (
          <EmptyPanel message="No active shipment alerts." />
        ) : (
          shipments.map((shipment) => (
            <Link
              key={shipment.id}
              href={`/shipments/${shipment.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 transition hover:border-primary/25 hover:bg-secondary/70"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {shipment.order.orderNumber}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {shipment.order.customerName} · {shipment.carrierName ?? 'Carrier pending'}
                </p>
              </div>
              <ShipmentStatusBadge status={shipment.currentStatus} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function ShipmentStatusBadge({ status }: { status: string }) {
  const variant = {
    PENDING: 'outline' as const,
    IN_TRANSIT: 'default' as const,
    DELIVERED: 'neutral' as const,
    DELAYED: 'danger' as const,
    CANCELLED: 'danger' as const,
  }[status] ?? 'outline' as const;

  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
}
