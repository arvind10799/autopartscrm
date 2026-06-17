'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Truck,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { DashboardMetricCard } from '@/components/app-shell/DashboardMetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/store/auth.store';
import {
  buildTimestampRangeQuery,
  createDefaultDateRangeFilterState,
} from '@/lib/filters/date-range';
import { ordersApi } from '@/features/orders/api/orders-api';
import { shipmentsApi } from '@/features/shipments/api/shipments-api';
import type { OrderSummary } from '@/features/orders/types/order.types';
import type { ShipmentSummary } from '@/features/shipments/types/shipment.types';
import type { UserRole } from '@/features/auth/types/auth.types';

interface DashboardData {
  orders: OrderSummary[];
  orderTotal: number;
  shipments: ShipmentSummary[];
  shipmentTotal: number;
}

function computeMetrics(data: DashboardData, role: UserRole) {
  const { orders, orderTotal, shipments, shipmentTotal } = data;

  const draftOrders = orders.filter((o) => o.status === 'DRAFT').length;
  const partiallyPaidOrders = orders.filter(
    (o) => o.status === 'PARTIALLY_PAID',
  ).length;
  const confirmedOrders = orders.filter((o) => o.status === 'CONFIRMED').length;
  const inTransit = shipments.filter((s) => s.currentStatus === 'IN_TRANSIT').length;
  const delivered = shipments.filter((s) => s.currentStatus === 'DELIVERED').length;
  const delayed = shipments.filter((s) => s.currentStatus === 'DELAYED').length;
  const pending = shipments.filter((s) => s.currentStatus === 'PENDING').length;

  if (role === 'SALES') {
    return [
      { label: 'Total Orders', value: String(orderTotal), hint: `${draftOrders} drafts, ${partiallyPaidOrders} partially paid` },
      { label: 'Shipped', value: String(orders.filter((o) => o.status === 'SHIPPED').length), hint: 'Orders currently shipped' },
      { label: 'In Transit', value: String(inTransit), hint: `${delayed} delayed` },
      { label: 'Delivered', value: String(delivered), hint: 'Completed deliveries' },
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
    { label: 'Revenue', value: `$${orders.reduce((sum, o) => sum + o.totalSaleAmount, 0).toLocaleString()}`, hint: `Across ${orderTotal} orders` },
  ];
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
        const [ordersRes, shipmentsRes] = await Promise.all([
          ordersApi
            .list({
              page: 1,
              limit: 100,
              createdFrom: dateRangeQuery.createdFrom,
              createdTo: dateRangeQuery.createdTo,
            })
            .catch(() => ({ items: [] as OrderSummary[], meta: { total: 0 } })),
          shipmentsApi
            .list({
              page: 1,
              limit: 100,
              createdFrom: dateRangeQuery.createdFrom,
              createdTo: dateRangeQuery.createdTo,
            })
            .catch(() => ({ items: [] as ShipmentSummary[], meta: { total: 0 } })),
        ]);

        if (cancelled) return;
        setData({
          orders: ordersRes.items,
          orderTotal: ordersRes.meta.total,
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

  const metrics = computeMetrics(data, role);
  const recentOrders = data.orders.slice(0, 5);
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

      {/* Content grid */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Recent Orders — visible to ADMIN and SALES */}
        {(role === 'ADMIN' || role === 'SALES') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Recent Orders
              </CardTitle>
              <Link href="/orders">
                <Button variant="ghost" size="sm" className="text-xs">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {recentOrders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{order.orderNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">{order.customerName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">${order.totalSaleAmount.toLocaleString()}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Shipments — visible to ADMIN and SHIPPING */}
        {(role === 'ADMIN' || role === 'SHIPPING') && (
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
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-3 transition hover:bg-slate-50"
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
        )}
      </div>
    </section>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const variant = {
    DRAFT: 'outline' as const,
    PARTIALLY_PAID: 'default' as const,
    CONFIRMED: 'default' as const,
    PROCESSING: 'default' as const,
    SHIPPED: 'default' as const,
    DELIVERED: 'neutral' as const,
    CANCELLED: 'danger' as const,
  }[status] ?? 'outline' as const;

  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
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
