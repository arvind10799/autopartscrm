'use client';

import type { ReactNode } from 'react';
import { FileStack, History, PackageCheck, Search, X } from 'lucide-react';
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  buildTimestampRangeQuery,
  createDefaultDateRangeFilterState,
} from '@/lib/filters/date-range';
import { toast } from '@/lib/stores/toast.store';
import { useOrderDetail } from '@/features/orders/hooks/useOrderDetail';
import { useOrdersList } from '@/features/orders/hooks/useOrdersList';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatOrderPaymentMethod,
  formatOrderStatus,
} from '@/features/orders/lib/order-formatters';
import type {
  OrderDetail,
  OrderNote,
  OrderSummary,
} from '@/features/orders/types/order.types';
import { CreateShipmentForm } from './CreateShipmentForm';
import { ShipmentEligibleOrdersTable } from './ShipmentEligibleOrdersTable';

export function CreateShipmentWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(
    createDefaultDateRangeFilterState(),
  );
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeSearch = deferredSearchTerm.trim();
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter],
  );

  const { ordersResponse, isLoading, error } = useOrdersList({
    page,
    search: activeSearch,
    hasShipment: false,
    createdFrom: dateRangeQuery.createdFrom,
    createdTo: dateRangeQuery.createdTo,
    refreshKey,
  });

  const totalEligibleRevenue = useMemo(
    () =>
      ordersResponse.items.reduce(
        (sum, order) => sum + order.totalSaleAmount,
        0,
      ),
    [ordersResponse.items],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (ordersResponse.meta.totalPages === 0 && page !== 1) {
      startTransition(() => setPage(1));
      return;
    }

    if (ordersResponse.meta.totalPages > 0 && page > ordersResponse.meta.totalPages) {
      startTransition(() => setPage(ordersResponse.meta.totalPages));
    }
  }, [isLoading, ordersResponse.meta.totalPages, page]);

  useEffect(() => {
    if (!selectedOrder) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedOrder]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    startTransition(() => setPage(1));
  };

  const handleRetry = () => {
    setRefreshKey((currentValue) => currentValue + 1);
  };

  const handleShipmentCreated = () => {
    const completedOrder = selectedOrder;

    setSelectedOrder(null);
    startTransition(() => setPage(1));
    setRefreshKey((currentValue) => currentValue + 1);

    if (completedOrder) {
      toast.success(
        `Shipment created for ${completedOrder.orderNumber}`,
        'The shipped order has been removed from the eligible orders list.',
      );
    }
  };

  return (
    <>
      <section className="grid gap-6">
        <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Orders awaiting shipment</CardDescription>
              <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
                {ordersResponse.meta.total}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Orders without shipment records are available for the shipping team.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Visible sales value</CardDescription>
              <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
                {formatCurrency(totalEligibleRevenue)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Revenue represented by the currently visible eligible orders.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Workflow</CardDescription>
              <CardTitle className="text-2xl sm:text-[1.75rem]">Pick and ship</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Open a focused shipment workspace directly from any eligible order.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="space-y-2">
              <CardTitle className="text-2xl sm:text-[1.75rem]">Eligible orders</CardTitle>
              <CardDescription>
                Click an order to open a shipment workspace with full order context.
              </CardDescription>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="pl-9"
                placeholder="Search by order number, customer, part, or sales agent"
              />
            </div>
          </CardHeader>

          <CardContent>
            <ShipmentEligibleOrdersTable
              orders={ordersResponse.items}
              meta={ordersResponse.meta}
              isLoading={isLoading}
              error={error}
              onRetry={handleRetry}
              onPageChange={setPage}
              selectedOrderId={selectedOrder?.id ?? null}
              onSelectOrder={setSelectedOrder}
            />
          </CardContent>
        </Card>

        <EmptyState
          icon={<PackageCheck className="h-5 w-5" />}
          title="Open a shipment workspace from the table"
          description="Selecting an eligible order opens a dedicated popup with full order details, notes, and the shipment creation form side by side."
          className="max-w-none bg-white"
        />
      </section>

      {selectedOrder ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 px-4 py-4 backdrop-blur-sm sm:py-6"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="w-full max-w-7xl rounded-[1.9rem] border border-border/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
              <div className="space-y-1">
                <h2 className="font-[var(--font-heading)] text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  Shipment workspace
                </h2>
                <p className="text-sm text-muted-foreground">
                  Review {selectedOrder.orderNumber} and create its shipment without
                  leaving the eligible orders list.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close shipment workspace popup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(100vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,0.9fr)]">
                <ShipmentOrderDetailsPanel selectedOrder={selectedOrder} />

                <div className="xl:sticky xl:top-0 xl:self-start">
                  <Card className="overflow-hidden border-border/70 shadow-sm">
                    <CardHeader className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(255,255,255,0.98))]">
                      <CardDescription>Create shipment</CardDescription>
                      <CardTitle className="text-2xl sm:text-[1.75rem]">
                        Dispatch this order
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                      <CreateShipmentForm
                        selectedOrder={selectedOrder}
                        onCreated={handleShipmentCreated}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ShipmentOrderDetailsPanel({
  selectedOrder,
}: {
  selectedOrder: OrderSummary;
}) {
  const { order, isLoading, error } = useOrderDetail(selectedOrder.id);

  if (isLoading) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardDescription>Selected order</CardDescription>
          <CardTitle className="text-2xl sm:text-[1.75rem]">
            Loading order details...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pulling notes, intake details, and shipping instructions for this order.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error || !order) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardDescription>Selected order</CardDescription>
          <CardTitle className="text-2xl sm:text-[1.75rem]">
            Order details unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'The selected order could not be loaded right now.'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const intake = order.intakeDetails;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.98))]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <CardDescription>Selected order</CardDescription>
              <CardTitle className="text-2xl sm:text-[1.75rem]">
                {order.orderNumber}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {order.customerName} ordered {order.partDescription}.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[25rem]">
              <MetricCard label="Status" value={formatOrderStatus(order.status)} />
              <MetricCard label="Sale value" value={formatCurrency(order.totalSaleAmount)} />
              <MetricCard label="Notes" value={String(order.notes.length)} />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-2">
        <DetailGroup title="Order and customer" icon={<FileStack className="h-4 w-4 text-primary" />}>
          <DetailGrid>
            <DetailBlock label="Order number" value={order.orderNumber} />
            <DetailBlock
              label="Order date"
              value={intake.orderDate ? formatDate(intake.orderDate) : 'Not provided'}
            />
            <DetailBlock label="Customer" value={order.customerName} />
            <DetailBlock label="Mobile" value={order.customerPhone ?? 'Not provided'} />
            <DetailBlock label="Email" value={order.customerEmail ?? 'Not provided'} />
            <DetailBlock
              label="Sales agent"
              value={`${order.createdBy.name}\n${order.createdBy.email}`}
            />
          </DetailGrid>
        </DetailGroup>

        <DetailGroup title="Part and vehicle" icon={<PackageCheck className="h-4 w-4 text-primary" />}>
          <DetailGrid>
            <DetailBlock label="Part" value={order.partDescription} />
            <DetailBlock label="Make" value={intake.vehicleMake ?? 'Not provided'} />
            <DetailBlock label="Model" value={intake.vehicleModel ?? 'Not provided'} />
            <DetailBlock label="Year" value={intake.vehicleYear ?? 'Not provided'} />
            <DetailBlock label="Variant" value={intake.vehicleVariant ?? 'Not provided'} />
            <DetailBlock label="VIN" value={intake.vehicleVin ?? 'Not provided'} />
            <DetailBlock
              label="Configuration"
              value={intake.vehicleConfiguration ?? 'Not provided'}
              className="2xl:col-span-2"
            />
            <DetailBlock
              label="Vehicle notes"
              value={intake.vehicleNotes ?? 'Not provided'}
              className="2xl:col-span-2"
            />
          </DetailGrid>
        </DetailGroup>

        <DetailGroup title="Billing and shipping" icon={<History className="h-4 w-4 text-primary" />}>
          <DetailGrid>
            <DetailBlock
              label="Billing address"
              value={intake.billingAddress ?? 'Not provided'}
              className="2xl:col-span-2"
            />
            <DetailBlock
              label="Billing person"
              value={intake.billingPerson ?? 'Not provided'}
            />
            <DetailBlock
              label="Billing phone"
              value={intake.billingPhone ?? 'Not provided'}
            />
            <DetailBlock
              label="Shipping address"
              value={intake.shippingAddress ?? 'Not provided'}
              className="2xl:col-span-2"
            />
            <DetailBlock
              label="Shipping person"
              value={intake.shippingPerson ?? 'Not provided'}
            />
            <DetailBlock
              label="Shipping phone"
              value={intake.shippingPhone ?? 'Not provided'}
            />
            <DetailBlock
              label="Shipping date"
              value={intake.shippingAt ? formatDate(intake.shippingAt) : 'Not provided'}
            />
            <DetailBlock
              label="Company name"
              value={intake.companyName ?? 'Not provided'}
            />
          </DetailGrid>
        </DetailGroup>

        <DetailGroup title="Commercials" icon={<FileStack className="h-4 w-4 text-primary" />}>
          <DetailGrid>
            <DetailBlock
              label="Price offered"
              value={formatCurrency(order.salePrice)}
            />
            <DetailBlock label="Quantity" value={String(order.quantity)} />
            <DetailBlock
              label="Total sale"
              value={formatCurrency(order.totalSaleAmount)}
            />
            <DetailBlock
              label="Miles offered"
              value={formatNullableNumber(intake.milesOffered)}
            />
            <DetailBlock
              label="Base price"
              value={formatNullableCurrency(intake.basePrice)}
            />
            <DetailBlock
              label="Sales tax"
              value={formatNullableCurrency(intake.salesTax)}
            />
            <DetailBlock
              label="Shipping charges"
              value={formatNullableCurrency(intake.shippingCharges)}
            />
            <DetailBlock
              label="Profit"
              value={formatNullableCurrency(intake.profit)}
            />
            <DetailBlock
              label="Partial payment"
              value={formatNullableCurrency(intake.partialPayment)}
            />
            <DetailBlock
              label="Payment method"
              value={
                order.paymentMethod
                  ? formatOrderPaymentMethod(order.paymentMethod)
                  : 'Not required'
              }
            />
          </DetailGrid>
        </DetailGroup>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Notes and edit history</CardTitle>
          <CardDescription>
            Shipping can review every customer note and prior order edit before dispatch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {order.notes.length > 0 ? (
            <div className="space-y-3">
              {order.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-2xl border border-border/70 bg-secondary/20 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isHistoryNote(note) ? 'info' : 'secondary'}>
                      {isHistoryNote(note) ? 'Edit history' : 'Note'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {note.author.name} | {formatDateTime(note.createdAt)}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
              No notes or edit history entries have been recorded for this order yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function DetailBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">
          {value}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 px-3.5 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatNullableCurrency(value: number | null): string {
  return value === null ? 'Not provided' : formatCurrency(value);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'Not provided' : String(value);
}

function isHistoryNote(note: OrderNote): boolean {
  return note.content.startsWith('Order updated:');
}
