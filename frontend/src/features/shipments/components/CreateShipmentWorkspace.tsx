'use client';

import type { ReactNode } from 'react';
import {
  ArrowLeft,
  FileStack,
  History,
  LoaderCircle,
  MessageSquarePlus,
  PackageCheck,
  TrendingUp,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { Select } from '@/components/ui/select';
import {
  buildTimestampRangeQuery,
  createDefaultDateRangeFilterState,
} from '@/lib/filters/date-range';
import { toast } from '@/lib/stores/toast.store';
import { InvoiceActions } from '@/features/invoices/components/InvoiceActions';
import { notesApi } from '@/features/notes/api/notes-api';
import {
  OrderResolutionActions,
  OrderResolutionDetails,
} from '@/features/orders/components/OrderResolutionActions';
import { useOrderDetailWithRefresh } from '@/features/orders/hooks/useOrderDetail';
import { useOrdersList } from '@/features/orders/hooks/useOrdersList';
import {
  ALL_SHIPMENT_STATUS_FILTER,
  formatShipmentStatusOptionLabel,
  parseShipmentStatusFilter,
  REFUNDED_SHIPMENT_STATUS_FILTER,
  type ShipmentStatusFilter,
} from '@/features/orders/lib/orders.helpers';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatOrderPaymentMethod,
  formatOrderStatus,
  formatRelativeTime,
} from '@/features/orders/lib/order-formatters';
import { getOrderFinancialSummary } from '@/features/orders/lib/order-financials';
import type {
  OrderDetail,
  OrderNote,
  OrderShipmentStatus,
} from '@/features/orders/types/order.types';
import type { ShipmentSummary } from '../types/shipment.types';
import {
  CreateShipmentForm,
  type CreateShipmentCostDraft,
} from './CreateShipmentForm';
import { ShipmentEligibleOrdersTable } from './ShipmentEligibleOrdersTable';

const SHIPMENT_ORDER_STATUS_FILTERS = [
  'PENDING',
  'LOCATING',
  'PRE_PROCESSING',
  'PURCHASE',
  'CANCELLED',
  REFUNDED_SHIPMENT_STATUS_FILTER,
] as const satisfies readonly (OrderShipmentStatus | typeof REFUNDED_SHIPMENT_STATUS_FILTER)[];

export function CreateShipmentWorkspace() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [shipmentStatusFilter, setShipmentStatusFilter] =
    useState<ShipmentStatusFilter>(ALL_SHIPMENT_STATUS_FILTER);
  const [dateFilter, setDateFilter] = useState(
    createDefaultDateRangeFilterState(),
  );
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeSearch = deferredSearchTerm.trim();
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter],
  );

  const { ordersResponse, isLoading, error } = useOrdersList({
    page,
    search: activeSearch,
    shipmentStatus: shipmentStatusFilter,
    hasShipment:
      shipmentStatusFilter === ALL_SHIPMENT_STATUS_FILTER ? false : undefined,
    createdFrom: dateRangeQuery.createdFrom,
    createdTo: dateRangeQuery.createdTo,
    refreshKey,
  });

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

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    startTransition(() => setPage(1));
  };

  const handleShipmentStatusChange = (value: ShipmentStatusFilter) => {
    setShipmentStatusFilter(value);
    startTransition(() => setPage(1));
  };

  const handleRetry = () => {
    setRefreshKey((currentValue) => currentValue + 1);
  };

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl sm:text-[1.75rem]">Shipment orders</CardTitle>
              <CardDescription>
                Click an order to open a full shipment workspace with order context.
              </CardDescription>
            </div>
            <div className="w-full xl:max-w-xl">
              <DateRangeFilter
                value={dateFilter}
                onChange={setDateFilter}
                variant="inline"
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="pl-9"
                placeholder="Search by order number, customer, part, or sales agent"
              />
            </div>

            <Select
              value={shipmentStatusFilter}
              aria-label="Shipping status filter"
              onChange={(event) =>
                handleShipmentStatusChange(
                  parseShipmentStatusFilter(event.target.value),
                )
              }
            >
              <option value={ALL_SHIPMENT_STATUS_FILTER}>
                All shipping statuses
              </option>
              {SHIPMENT_ORDER_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {formatShipmentStatusOptionLabel(status)}
                </option>
              ))}
            </Select>
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
            selectedOrderId={null}
            onSelectOrder={(order) => router.push(`/shipments/create/${order.id}`)}
          />
        </CardContent>
      </Card>

      <EmptyState
        icon={<PackageCheck className="h-5 w-5" />}
        title="Open a shipment workspace from the table"
        description="Selecting an eligible order opens a full page with order details, notes, and shipment creation tools."
        className="max-w-none bg-white"
      />
    </section>
  );
}

export function ShipmentOrderWorkspacePage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [costDraft, setCostDraft] = useState<CreateShipmentCostDraft>({
    purchaseAmount: 0,
    shippingAmount: 0,
    additionalAmount: 0,
  });
  const { order, isLoading, error } = useOrderDetailWithRefresh(
    orderId,
    refreshKey,
  );

  const handleShipmentCreated = (shipment: ShipmentSummary) => {
    const completedOrder = order;
    const isOperationalShipment = shipment.currentStatus === 'SHIPPED';

    if (isOperationalShipment) {
      toast.success(
        completedOrder
          ? `Shipment created for ${completedOrder.orderNumber}`
          : 'Shipment created',
        'The shipped order is now available in the Shipment table.',
      );
      router.push('/shipments');
      return;
    } else {
      toast.success(
        completedOrder
          ? `Shipment workflow saved for ${completedOrder.orderNumber}`
          : 'Shipment workflow saved',
        'The order remains in Shipment orders until it is marked shipped with a BOL.',
      );
    }
    setRefreshKey((currentValue) => currentValue + 1);
  };

  if (isLoading) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardDescription>Shipment workspace</CardDescription>
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
          <CardDescription>Shipment workspace</CardDescription>
          <CardTitle className="text-2xl sm:text-[1.75rem]">
            Order details unavailable
          </CardTitle>
          <CardDescription>
            {error ?? 'The selected order could not be loaded right now.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/shipments/create')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to shipment orders
          </Button>
        </CardContent>
      </Card>
    );
  }

  const shipmentStatusNotes = buildShipmentStatusNotes(order.notes);
  const isOrderResolvedForShipment =
    order.status === 'CANCELLED' || order.status === 'REFUNDED';

  return (
    <section className="grid gap-6">
      <InvoiceActions
        order={order}
        onInvoiceCreated={() => setRefreshKey((currentValue) => currentValue + 1)}
        backLink={{
          href: '/shipments/create',
          label: 'Back to shipment orders',
        }}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,0.9fr)]">
        <ShipmentOrderDetailsPanel
          order={order}
          costDraft={costDraft}
          onRefresh={() => setRefreshKey((currentValue) => currentValue + 1)}
        />

        <div className="xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(255,255,255,0.98))]">
              <CardDescription>Create shipment</CardDescription>
              <CardTitle className="text-2xl sm:text-[1.75rem]">
                Dispatch this order
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <ShipmentStatusHistoryPanel notes={shipmentStatusNotes} />
              {isOrderResolvedForShipment ? (
                <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Status updates are disabled because this order is{' '}
                  {formatOrderStatus(order.status)}.
                </div>
              ) : (
                <CreateShipmentForm
                  selectedOrder={order}
                  onCostDraftChange={setCostDraft}
                  onCreated={handleShipmentCreated}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function ShipmentOrderDetailsPanel({
  order,
  costDraft,
  onRefresh,
}: {
  order: OrderDetail;
  costDraft: CreateShipmentCostDraft;
  onRefresh: () => void;
}) {
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const handleAddNoteSubmit = async () => {
    const trimmedMessage = noteMessage.trim();

    if (!trimmedMessage) {
      setNoteError('Note message is required.');
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);

    try {
      await notesApi.create({
        entityType: 'ORDER',
        entityId: order.id,
        message: trimmedMessage,
      });
      setNoteMessage('');
      setIsAddNoteOpen(false);
      onRefresh();
      toast.success('Note added', 'The shipment workspace notes have been refreshed.');
    } catch (caughtError) {
      setNoteError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to add this note right now.',
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  const intake = order.intakeDetails;
  const financialSummary = getOrderFinancialSummary(order);

  return (
    <div className="space-y-3">
      <ShipmentWorkspaceGpCard
        order={order}
        costDraft={costDraft}
        retainedAmount={financialSummary.gpSaleBasis}
      />

      <div className="grid gap-3 2xl:grid-cols-2">
        <DetailGroup title="Order and customer" icon={<FileStack className="h-4 w-4 text-primary" />}>
          <DetailGrid>
            <DetailBlock label="Order number" value={order.orderNumber} />
            <DetailBlock
              label="Order date"
              value={intake.orderDate ? formatDate(intake.orderDate) : 'Not provided'}
            />
            <DetailBlock label="Customer" value={order.customerName} />
            <DetailBlock label="Mobile" value={order.customerPhone ?? 'Not provided'} />
            <DetailBlock
              label="Email"
              value={order.customerEmail ?? 'Not provided'}
              breakAnywhere
            />
            <DetailBlock
              label="Sales agent"
              value={`${order.createdBy.name}\n${order.createdBy.email}`}
              breakAnywhere
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
              label="Part Description"
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
              value={
                <ShippingAddressValue
                  businessName={intake.companyName}
                  shippingAddress={intake.shippingAddress}
                />
              }
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
          </DetailGrid>
        </DetailGroup>

        <DetailGroup title="Commercials" icon={<FileStack className="h-4 w-4 text-primary" />}>
          <DetailGrid>
            <DetailBlock
              label="Price offered"
              value={formatCurrency(order.salePrice, order.currency)}
            />
            <DetailBlock label="Quantity" value={String(order.quantity)} />
            <DetailBlock
              label="Total sale"
              value={formatCurrency(order.totalSaleAmount, order.currency)}
            />
            <DetailBlock
              label="Miles offered"
              value={formatNullableText(intake.milesOffered)}
            />
            <DetailBlock
              label="Base price"
              value={formatNullableCurrency(intake.basePrice, order.currency)}
            />
            <DetailBlock
              label="Sales tax"
              value={formatNullableCurrency(intake.salesTax, order.currency)}
            />
            <DetailBlock
              label="Shipping charges"
              value={formatNullableCurrency(intake.shippingCharges, order.currency)}
            />
            <DetailBlock
              label="Profit"
              value={formatNullableCurrency(intake.profit, order.currency)}
            />
            <DetailBlock
              label="Paid"
              value={formatPaidAmount(order)}
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

      <OrderResolutionDetails order={order} />

      <OrderResolutionActions
        order={order}
        onResolved={onRefresh}
        className="rounded-2xl border border-border/70 bg-secondary/10 p-3"
      />

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Notes and edit history</CardTitle>
              <CardDescription className="text-xs">
                Shipping can review and add customer notes before dispatch.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setIsAddNoteOpen((currentValue) => !currentValue);
                setNoteError(null);
              }}
            >
              <MessageSquarePlus className="h-4 w-4" />
              Add Note
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-2">
          {isAddNoteOpen ? (
            <form
              className="space-y-2.5 rounded-xl border border-border/70 bg-secondary/20 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddNoteSubmit();
              }}
            >
              <label
                htmlFor="shipment-workspace-order-note"
                className="text-sm font-semibold text-foreground"
              >
                New note
              </label>
              <textarea
                id="shipment-workspace-order-note"
                value={noteMessage}
                rows={3}
                onChange={(event) => setNoteMessage(event.target.value)}
                placeholder="Add a shipping handoff, customer update, or dispatch note."
                className={`w-full rounded-2xl border bg-white/90 px-4 py-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  noteError ? 'border-destructive/60' : 'border-input'
                }`}
              />
              {noteError ? (
                <p className="text-sm text-destructive">{noteError}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={isSavingNote}>
                  {isSavingNote ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save note'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddNoteOpen(false);
                    setNoteError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {order.notes.length > 0 ? (
            <div className="space-y-2">
              {order.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-border/70 bg-background/85 px-3 py-2.5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {note.author.name}
                      <span className="mx-1.5 text-muted-foreground">|</span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {formatDateTime(note.createdAt)} ({formatRelativeTime(note.createdAt)})
                      </span>
                    </p>
                    <Badge
                      variant={
                        isShipmentStatusHistoryNote(note)
                          ? 'warning'
                          : isHistoryNote(note)
                            ? 'info'
                            : 'secondary'
                      }
                    >
                      {isShipmentStatusHistoryNote(note)
                        ? 'Shipment status'
                        : isHistoryNote(note)
                          ? 'Edit history'
                          : 'Note'}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
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
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">{children}</CardContent>
    </Card>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 md:grid-cols-2">{children}</div>;
}

function DetailBlock({
  label,
  value,
  className,
  breakAnywhere = false,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  breakAnywhere?: boolean;
}) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <div className="h-full min-w-0 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
        <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <div
          className={`mt-1 min-w-0 whitespace-pre-wrap text-sm leading-5 text-foreground ${
            breakAnywhere ? 'break-all' : 'break-words'
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function ShippingAddressValue({
  businessName,
  shippingAddress,
}: {
  businessName?: string | null;
  shippingAddress?: string | null;
}) {
  const trimmedBusinessName = businessName?.trim();
  const trimmedShippingAddress = shippingAddress?.trim();

  if (!trimmedBusinessName && !trimmedShippingAddress) {
    return 'Not provided';
  }

  return (
    <div className="space-y-1">
      {trimmedBusinessName ? (
        <p className="font-semibold text-foreground">{trimmedBusinessName}</p>
      ) : null}
      {trimmedShippingAddress ? (
        <p className="whitespace-pre-wrap text-foreground">{trimmedShippingAddress}</p>
      ) : null}
    </div>
  );
}

function ShipmentWorkspaceGpCard({
  order,
  costDraft,
  retainedAmount,
}: {
  order: OrderDetail;
  costDraft: CreateShipmentCostDraft;
  retainedAmount: number;
}) {
  const totalCosts =
    costDraft.purchaseAmount +
    costDraft.shippingAmount +
    costDraft.additionalAmount;
  const grossProfit = retainedAmount - totalCosts;
  const isRefunded = order.status === 'REFUNDED';

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.98))] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <CardDescription className="text-xs">GP calculation</CardDescription>
                <CardTitle className="truncate text-xl">
                  {formatCurrency(grossProfit, order.currency)}
                </CardTitle>
              </div>
            </div>
            <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
              {order.orderNumber} · {order.customerName}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[24rem]">
            <MetricCard
              label="Sale Amount"
              value={formatCurrency(order.totalSaleAmount, order.currency)}
            />
            {isRefunded ? (
              <MetricCard
                label="Refund retained"
                value={formatCurrency(retainedAmount, order.currency)}
              />
            ) : null}
            <MetricCard
              label="Total costs"
              value={formatCurrency(totalCosts, order.currency)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 p-4 sm:grid-cols-3">
        <MetricCard
          label="Part cost"
          value={formatCurrency(costDraft.purchaseAmount, order.currency)}
        />
        <MetricCard
          label="Actual shipping"
          value={formatCurrency(costDraft.shippingAmount, order.currency)}
        />
        <MetricCard
          label="Additional costs"
          value={formatCurrency(costDraft.additionalAmount, order.currency)}
        />
      </CardContent>
    </Card>
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
    <div className="rounded-xl border border-white/70 bg-white/85 px-3 py-2 shadow-sm">
      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ShipmentStatusHistoryPanel({ notes }: { notes: OrderNote[] }) {
  const latestNote = notes[0];

  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <History className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Last Status Update
          </p>
          {latestNote ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {latestNote.author.name} · {formatDateTime(latestNote.createdAt)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              No shipment status updates yet.
            </p>
          )}
        </div>
      </div>

      {notes.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Status update history
          </p>
          <div className="space-y-2">
            {notes.slice(0, 4).map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-border/60 bg-white/80 px-3 py-2"
              >
                <p className="whitespace-pre-wrap text-xs font-medium text-foreground">
                  {formatShipmentStatusHistoryBody(note.content)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {note.author.name} · {formatDateTime(note.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildShipmentStatusNotes(notes: OrderNote[]): OrderNote[] {
  return notes
    .filter(isShipmentStatusHistoryNote)
    .sort(
      (firstNote, secondNote) =>
        new Date(secondNote.createdAt).getTime() -
        new Date(firstNote.createdAt).getTime(),
    );
}

function formatShipmentStatusHistoryBody(content: string): string {
  return content.replace(/^Shipment status updated:\s*/i, '').trim();
}

function formatNullableCurrency(value: number | null, currency = 'USD'): string {
  return value === null ? 'Not provided' : formatCurrency(value, currency);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'Not provided' : String(value);
}

function formatNullableText(value: string | null): string {
  return value?.trim() ? value : 'Not provided';
}

function formatPaidAmount(order: OrderDetail): string {
  return formatCurrency(
    getOrderFinancialSummary(order).retainedPaidAmount,
    order.currency,
  );
}

function isHistoryNote(note: OrderNote): boolean {
  return note.content.startsWith('Order updated:');
}

function isShipmentStatusHistoryNote(note: OrderNote): boolean {
  return note.content.startsWith('Shipment status updated:');
}
