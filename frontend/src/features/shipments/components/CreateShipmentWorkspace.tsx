'use client';

import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  History,
  LoaderCircle,
  PackageCheck,
  Plus,
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
import { useAuthStore } from '@/features/auth/store/auth.store';
import { InvoiceActions } from '@/features/invoices/components/InvoiceActions';
import { notesApi } from '@/features/notes/api/notes-api';
import type { NoteRecord } from '@/features/notes/types/note.types';
import {
  OrderResolutionActions,
  OrderResolutionDetails,
} from '@/features/orders/components/OrderResolutionActions';
import { GrossProfitSummaryCard } from '@/features/shipments/components/GrossProfitSummaryCard';
import { ShipmentStatusBadge } from '@/features/shipments/components/ShipmentStatusBadge';
import { cn } from '@/lib/utils/cn';
import { useOrderDetailWithRefresh } from '@/features/orders/hooks/useOrderDetail';
import { useOrdersList } from '@/features/orders/hooks/useOrdersList';
import {
  ALL_SHIPMENT_STATUS_FILTER,
  formatShipmentStatusOptionLabel,
  parseShipmentStatusFilter,
  REFUNDED_SHIPMENT_STATUS_FILTER,
  REPLACEMENT_SHIPMENT_STATUS_FILTER,
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
import { CreateShipmentForm } from './CreateShipmentForm';
import { ShipmentEligibleOrdersTable } from './ShipmentEligibleOrdersTable';

type TimelineEntry = {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  body: ReactNode;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
};

const SHIPMENT_ORDER_STATUS_FILTERS = [
  REPLACEMENT_SHIPMENT_STATUS_FILTER,
  'PENDING',
  'LOCATING',
  'PRE_PROCESSING',
  'PURCHASE',
  'DISPUTED',
  'CANCELLED',
  REFUNDED_SHIPMENT_STATUS_FILTER,
] as const satisfies readonly (
  | OrderShipmentStatus
  | typeof REFUNDED_SHIPMENT_STATUS_FILTER
  | typeof REPLACEMENT_SHIPMENT_STATUS_FILTER
)[];

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
    <section className="grid gap-4">
      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950/80">
        <CardHeader className="space-y-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <CardTitle className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
              Shipment orders
            </CardTitle>
          </div>

          <div
            className={
              dateFilter.preset === 'CUSTOM'
                ? 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start xl:grid-cols-[minmax(0,1fr)_220px_34rem]'
                : 'grid gap-3 lg:grid-cols-[1fr_220px_220px]'
            }
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="h-11 rounded-xl border-slate-200 bg-white pl-9 dark:border-slate-800 dark:bg-slate-900"
                placeholder="Search by order number, customer, part, or adviser"
              />
            </div>

            <Select
              value={shipmentStatusFilter}
              aria-label="Shipping status filter"
              className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
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

            <div
              className={
                dateFilter.preset === 'CUSTOM'
                  ? 'min-w-0 lg:col-span-2 xl:col-span-1'
                  : 'min-w-0'
              }
            >
              <DateRangeFilter
                value={dateFilter}
                onChange={setDateFilter}
                variant="inline"
                showPresetLabel={false}
                inlineCustomLayout="row"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
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
    </section>
  );
}

export function ShipmentOrderWorkspacePage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const authUser = useAuthStore((state) => state.user);
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
        'The order remains in Shipment orders until it is marked shipped.',
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

  const isOrderResolvedForShipment =
    order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const financialSummary = getOrderFinancialSummary(order);
  const latestShipment = order.shipments[0] ?? null;
  const latestShipmentCost = latestShipment?.costs[0] ?? null;
  const canManageGpCosts =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';

  return (
    <section className="grid gap-5">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <InvoiceActions
          order={order}
          onInvoiceCreated={() => setRefreshKey((currentValue) => currentValue + 1)}
        />

        <GrossProfitSummaryCard
          shipmentId={latestShipment?.id}
          orderId={order.id}
          totalSaleAmount={financialSummary.gpSaleBasis}
          originalSaleAmount={order.totalSaleAmount}
          currency={order.currency}
          cost={latestShipmentCost}
          saleMetricLabel={order.status === 'REFUNDED' ? 'Refund retained' : 'Sale'}
          grossProfitOverride={financialSummary.grossProfitOverride}
          refundDetails={
            order.status === 'REFUNDED'
              ? {
                  refundType: order.intakeDetails.refundType,
                  refundDeductionAmount:
                    order.intakeDetails.refundDeductionAmount,
                  refundDeductionReason:
                    order.intakeDetails.refundDeductionReason,
                  customerRefundedAmount: financialSummary.refundedAmount,
                  refundedAt: order.intakeDetails.refundedAt,
                }
              : null
          }
          additionalCosts={latestShipment?.additionalCosts ?? []}
          costHistories={latestShipment?.costHistories ?? []}
          canAddAdditionalCost={canManageGpCosts}
          canEditBaseCost={canManageGpCosts}
          canEditAdditionalCosts={canManageGpCosts}
          onAdditionalCostAdded={() =>
            setRefreshKey((currentValue) => currentValue + 1)
          }
          onCostUpdated={() => setRefreshKey((currentValue) => currentValue + 1)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <div className="grid gap-5">
          <ShipmentOrderDetailsPanel
            order={order}
            onRefresh={() => setRefreshKey((currentValue) => currentValue + 1)}
          />

          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/70 px-4 py-3">
              <CardTitle className="text-lg">Create shipment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {isOrderResolvedForShipment ? (
                <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                  Status updates are disabled because this order is{' '}
                  {formatOrderStatus(order.status)}.
                </div>
              ) : (
                <CreateShipmentForm
                  selectedOrder={order}
                  onCreated={handleShipmentCreated}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <ShipmentWorkspaceNotesCard
            order={order}
            shipment={latestShipment}
            onRefresh={() => setRefreshKey((currentValue) => currentValue + 1)}
          />
        </aside>
      </div>
    </section>
  );
}

export function ShipmentOrderDetailsPanel({
  order,
  onRefresh,
}: {
  order: OrderDetail;
  onRefresh: () => void;
}) {
  const intake = order.intakeDetails;
  const financialSummary = getOrderFinancialSummary(order);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <CardTitle className="text-lg">Order details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3.5 sm:p-4">
        <DetailGroup title="Basic Order Info" tone="orange">
            <DetailBlock label="Order number" value={order.orderNumber} />
            <DetailBlock
              label="Sales Number"
              value={order.salesNumber ?? 'Not provided'}
            />
            <DetailBlock
              label="Date"
              value={intake.orderDate ? formatDate(intake.orderDate) : 'Not provided'}
            />
            <DetailBlock label="Customer" value={order.customerName} />
            <DetailBlock
              label="Sales agent"
              value={intake.advisorName ?? order.createdBy.name}
            />
        </DetailGroup>

        <DetailGroup title="Customer Info" tone="blue">
          <DetailBlock label="Name" value={order.customerName} />
          <DetailBlock label="Mobile" value={order.customerPhone ?? 'Not provided'} />
          <DetailBlock label="Email" value={order.customerEmail ?? 'Not provided'} />
        </DetailGroup>

        <DetailGroup title="Vehicle / Part Info" tone="teal">
            <DetailBlock label="Parts" value={order.partDescription} />
            <DetailBlock label="Make" value={intake.vehicleMake ?? 'Not provided'} />
            <DetailBlock label="Model" value={intake.vehicleModel ?? 'Not provided'} />
            <DetailBlock label="Year" value={intake.vehicleYear ?? 'Not provided'} />
            <DetailBlock label="Part" value={intake.vehicleVariant ?? 'Not provided'} />
            <DetailBlock label="VIN" value={intake.vehicleVin ?? 'Not provided'} />
            <DetailBlock
              label="Part Description"
              value={intake.vehicleNotes ?? 'Not provided'}
            />
        </DetailGroup>

        <CollapsibleDetailSection title="Billing Information" tone="amber">
            <DetailBlock
              label="Billing address"
              value={intake.billingAddress ?? 'Not provided'}
            />
            <DetailBlock
              label="Billing person"
              value={intake.billingPerson ?? 'Not provided'}
            />
            <DetailBlock
              label="Billing phone"
              value={intake.billingPhone ?? 'Not provided'}
            />
        </CollapsibleDetailSection>

        <CollapsibleDetailSection title="Shipping Information" tone="sky">
            <DetailBlock
              label="Shipping address"
              value={
                <ShippingAddressValue
                  businessName={intake.companyName}
                  shippingAddress={intake.shippingAddress}
                />
              }
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
              label="Shipping status"
              value={
                <ShippingStatusValue
                  shipmentCount={order.counts.shipments}
                  status={order.latestShipmentStatus}
                  orderStatus={order.status}
                />
              }
            />
        </CollapsibleDetailSection>

        <DetailGroup title="Pricing / Sales Info" tone="green">
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
              value={formatCurrency(financialSummary.retainedPaidAmount, order.currency)}
            />
            <DetailBlock
              label="Remaining amount"
              value={formatCurrency(financialSummary.remainingAmount, order.currency)}
            />
            <DetailBlock
              label="Payment method"
              value={
                order.paymentMethod
                  ? formatOrderPaymentMethod(order.paymentMethod)
                  : 'Not required'
              }
            />
        </DetailGroup>

      <OrderResolutionDetails order={order} />

      <OrderResolutionActions
        order={order}
        onResolved={onRefresh}
        className="rounded-2xl border border-border/70 bg-secondary/10 p-3"
      />
      </CardContent>
    </Card>
  );
}

function DetailGroup({
  title,
  tone = 'slate',
  children,
}: {
  title: string;
  tone?: DetailTone;
  children: ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border p-3 shadow-sm', getDetailToneClassName(tone))}>
      <h3 className="text-xs font-bold uppercase tracking-[0.16em]">
        {title}
      </h3>
      <DetailGrid>{children}</DetailGrid>
    </section>
  );
}

function CollapsibleDetailSection({
  title,
  tone = 'slate',
  children,
}: {
  title: string;
  tone?: DetailTone;
  children: ReactNode;
}) {
  return (
    <details className={cn('group rounded-xl border p-3 shadow-sm', getDetailToneClassName(tone))}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em] marker:hidden">
        {title}
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <DetailGrid>{children}</DetailGrid>
    </details>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">{children}</div>;
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[7.25rem_minmax(0,1fr)] gap-2 text-xs leading-5">
      <p className="font-bold uppercase text-foreground/85">
        {label}
      </p>
      <div className="min-w-0 whitespace-pre-wrap break-words font-medium text-foreground">
        {value}
      </div>
    </div>
  );
}

type DetailTone = 'orange' | 'blue' | 'teal' | 'amber' | 'sky' | 'green' | 'slate';

function getDetailToneClassName(tone: DetailTone) {
  const classes: Record<DetailTone, string> = {
    orange:
      'border-orange-200 bg-orange-50/70 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-200',
    blue:
      'border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200',
    teal:
      'border-teal-200 bg-teal-50/70 text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/20 dark:text-teal-200',
    amber:
      'border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200',
    sky:
      'border-sky-200 bg-sky-50/70 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200',
    green:
      'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200',
    slate:
      'border-border bg-secondary/20 text-foreground',
  };

  return classes[tone];
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

function ShippingStatusValue({
  status,
  orderStatus,
  shipmentCount,
}: {
  status: OrderShipmentStatus | null;
  orderStatus: OrderDetail['status'];
  shipmentCount: number;
}) {
  if (orderStatus === 'CANCELLED' || orderStatus === 'REFUNDED') {
    return <ShipmentStatusBadge status={orderStatus} />;
  }

  if (!status || shipmentCount === 0) {
    return <span className="text-sm text-muted-foreground">Shipment is not created yet</span>;
  }

  return <ShipmentStatusBadge status={status} />;
}

function ShipmentWorkspaceNotesCard({
  order,
  shipment,
  onRefresh,
}: {
  order: OrderDetail;
  shipment: OrderDetail['shipments'][number] | null;
  onRefresh: () => void;
}) {
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [shipmentNotes, setShipmentNotes] = useState<NoteRecord[]>([]);
  const [isLoadingShipmentNotes, setIsLoadingShipmentNotes] = useState(false);
  const [shipmentNotesError, setShipmentNotesError] = useState<string | null>(null);
  const shipmentId = shipment?.id;
  const noteEntries = buildNoteTimeline(order, shipmentNotes);
  const editHistoryEntries = buildEditHistoryTimeline(order, shipment);
  const statusHistoryEntries = buildStatusTimeline(order);

  useEffect(() => {
    if (!shipmentId) {
      setShipmentNotes([]);
      setIsLoadingShipmentNotes(false);
      setShipmentNotesError(null);
      return;
    }

    let isMounted = true;

    const loadShipmentNotes = async () => {
      setIsLoadingShipmentNotes(true);
      setShipmentNotesError(null);

      try {
        const notes = await notesApi.listByEntity('SHIPMENT', shipmentId);

        if (isMounted) {
          setShipmentNotes(notes);
        }
      } catch (caughtError) {
        if (isMounted) {
          setShipmentNotesError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load shipment notes.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingShipmentNotes(false);
        }
      }
    };

    void loadShipmentNotes();

    return () => {
      isMounted = false;
    };
  }, [shipmentId]);

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

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm xl:flex xl:max-h-[calc(100vh-3rem)] xl:flex-col">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-4 w-4 text-primary" />
            NOTES
          </CardTitle>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-lg bg-[#ff5a00] px-3 text-xs text-white hover:bg-[#e65000]"
            onClick={() => {
              setIsAddNoteOpen((currentValue) => !currentValue);
              setNoteError(null);
            }}
          >
            <Plus className="h-4 w-4" />
            Add note
          </Button>
        </div>
      </CardHeader>

      {isAddNoteOpen ? (
        <div className="border-b border-border/70 bg-card p-3.5 sm:p-4">
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddNoteSubmit();
            }}
          >
            <label
              htmlFor="shipment-workspace-note"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Add note
            </label>
            <textarea
              id="shipment-workspace-note"
              value={noteMessage}
              rows={3}
              onChange={(event) => setNoteMessage(event.target.value)}
              placeholder="Add note"
              className={cn(
                'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                noteError ? 'border-destructive/60' : null,
              )}
            />
            {noteError ? (
              <p className="text-sm text-destructive">{noteError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-3 text-xs"
                disabled={isSavingNote}
                onClick={() => {
                  setIsAddNoteOpen(false);
                  setNoteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 rounded-lg bg-[#ff5a00] px-3 text-xs text-white hover:bg-[#e65000]"
                disabled={isSavingNote}
              >
                {isSavingNote ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Submit'
                )}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <CardContent className="min-h-0 space-y-3 p-3.5 sm:p-4 xl:flex-1 xl:overflow-y-auto">
        {shipmentNotesError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {shipmentNotesError}
          </div>
        ) : null}

        {isLoadingShipmentNotes ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
            Loading notes...
          </div>
        ) : (
          <ActivityTimeline
            entries={noteEntries}
            emptyMessage="No internal notes yet."
          />
        )}
        <TimelineGroup
          title="Edit History Timeline"
          entries={editHistoryEntries}
          emptyMessage="No edit history has been recorded yet."
        />
        <TimelineGroup
          title="Status Change History"
          entries={statusHistoryEntries}
          emptyMessage="No status changes have been recorded yet."
        />
      </CardContent>
    </Card>
  );
}

function TimelineGroup({
  title,
  entries,
  emptyMessage,
}: {
  title: string;
  entries: TimelineEntry[];
  emptyMessage: string;
}) {
  return (
    <details className="group rounded-xl border border-border/70 bg-secondary/10 px-3 py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </span>
          <span className="text-xs text-muted-foreground">
            {entries.length} record{entries.length === 1 ? '' : 's'}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/60 pt-1 group-open:mt-2">
        <ActivityTimeline
          entries={entries}
          emptyMessage={emptyMessage}
          showBadges
        />
      </div>
    </details>
  );
}

function ActivityTimeline({
  entries,
  emptyMessage,
  showBadges = false,
}: {
  entries: TimelineEntry[];
  emptyMessage: string;
  showBadges?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className="relative space-y-3 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
      {entries.map((entry) => (
        <ActivityTimelineItem
          key={entry.id}
          entry={entry}
          showBadge={showBadges}
        />
      ))}
    </ol>
  );
}

function ActivityTimelineItem({
  entry,
  showBadge,
}: {
  entry: TimelineEntry;
  showBadge: boolean;
}) {
  return (
    <li className="relative pl-6">
      <span
        className={cn(
          'absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background',
          getTimelineDotClassName(entry.badgeVariant),
        )}
      />
      <div className="space-y-1">
        <p className="text-xs leading-5 text-muted-foreground">
          <span
            className={cn(
              'font-semibold',
              showBadge ? 'text-foreground' : 'text-[#d94d00] dark:text-orange-300',
            )}
          >
            {entry.actorName}
          </span>{' '}
          | {formatDateTime(entry.timestamp)} ({formatRelativeTime(entry.timestamp)})
        </p>
        {showBadge ? (
          <Badge
            variant={entry.badgeVariant ?? 'secondary'}
            className="h-5 rounded-md px-2 text-[10px]"
          >
            {entry.action}
          </Badge>
        ) : null}
        <div className="whitespace-pre-wrap text-xs font-medium leading-5 text-foreground">
          {entry.body}
        </div>
      </div>
    </li>
  );
}

function buildNoteTimeline(
  order: OrderDetail,
  shipmentNotes: NoteRecord[],
): TimelineEntry[] {
  const orderNoteEntries = order.notes
    .filter(isPlainOrderNote)
    .map((note) => ({
      id: note.id,
      timestamp: note.createdAt,
      actorName: note.author.name,
      action: 'Note',
      body: formatOrderNoteBody(note.content, order),
      badgeVariant: 'secondary' as const,
    }));
  const shipmentNoteEntries = shipmentNotes
    .filter((note) => isPlainUserNoteContent(note.message))
    .map((note) => ({
      id: `shipment-${note.id}`,
      timestamp: note.createdAt,
      actorName: note.author.name,
      action: 'Note',
      body: note.message,
      badgeVariant: 'secondary' as const,
    }));

  return [...orderNoteEntries, ...shipmentNoteEntries].sort(
    compareTimelineEntriesDesc,
  );
}

function buildEditHistoryTimeline(
  order: OrderDetail,
  shipment: OrderDetail['shipments'][number] | null,
): TimelineEntry[] {
  return [
    ...order.notes
      .filter(isOrderUpdateNote)
      .map((note) => ({
        id: note.id,
        timestamp: note.createdAt,
        actorName: note.author.name,
        action: 'Order edit',
        body: formatOrderHistoryBody(note.content),
        badgeVariant: 'info' as const,
      })),
    ...order.notes
      .filter(isInvoiceActivityNote)
      .map((note) => ({
        id: note.id,
        timestamp: note.createdAt,
        actorName: note.author.name,
        action: getInvoiceActivityLabel(note.content) ?? 'Invoice activity',
        body: formatInvoiceActivityBody(note.content),
        badgeVariant: 'info' as const,
      })),
    ...(shipment?.costHistories ?? []).map((history) => ({
      id: history.id,
      timestamp: history.createdAt,
      actorName: history.createdBy.name,
      action: 'GP edit',
      body: history.summary,
      badgeVariant: 'success' as const,
    })),
  ].sort(compareTimelineEntriesDesc);
}

function buildStatusTimeline(order: OrderDetail): TimelineEntry[] {
  return order.notes
    .filter((note) => isOrderStatusHistoryNote(note) || isShipmentStatusHistoryNote(note))
    .map((note) => ({
      id: note.id,
      timestamp: note.createdAt,
      actorName: note.author.name,
      action: isShipmentStatusHistoryNote(note) ? 'Status change' : 'Order status',
      body: isShipmentStatusHistoryNote(note)
        ? formatShipmentStatusHistoryBody(note.content)
        : formatOrderHistoryBody(note.content),
      badgeVariant: 'warning' as const,
    }))
    .sort(compareTimelineEntriesDesc);
}

function compareTimelineEntriesDesc(
  firstEntry: TimelineEntry,
  secondEntry: TimelineEntry,
) {
  return (
    new Date(secondEntry.timestamp).getTime() -
    new Date(firstEntry.timestamp).getTime()
  );
}

function getTimelineDotClassName(variant?: TimelineEntry['badgeVariant']) {
  switch (variant) {
    case 'warning':
      return 'bg-amber-500';
    case 'success':
      return 'bg-emerald-500';
    case 'danger':
      return 'bg-red-500';
    case 'info':
      return 'bg-sky-500';
    default:
      return 'bg-teal-500';
  }
}

function formatOrderNoteBody(content: string, order: OrderDetail): string {
  const trimmedContent = content.trim();

  if (!/^Order refunded:/i.test(trimmedContent)) {
    return trimmedContent;
  }

  return trimmedContent.replace(
    /- GP adjusted to \$0\.00/i,
    `- GP: ${formatCurrency(calculateOrderActualGp(order), order.currency)}`,
  );
}

function calculateOrderActualGp(order: OrderDetail): number {
  const financialSummary = getOrderFinancialSummary(order);
  const shipment = order.shipments[0] ?? null;
  const cost = shipment?.costs[0] ?? null;
  const additionalAmount =
    shipment && shipment.additionalCosts.length > 0
      ? shipment.additionalCosts.reduce((total, entry) => total + entry.amount, 0)
      : cost?.additionalAmount ?? 0;
  const totalCosts =
    (cost?.hasActualPurchaseAmount
      ? cost.purchaseAmount
      : cost?.estimatedPurchaseAmount ?? 0) +
    (cost?.hasActualShippingAmount
      ? cost.shippingAmount
      : cost?.estimatedShippingAmount ?? 0) +
    additionalAmount;

  return financialSummary.gpSaleBasis - totalCosts;
}

function isPlainOrderNote(note: OrderNote): boolean {
  return isPlainUserNoteContent(note.content);
}

function isPlainUserNoteContent(content: string): boolean {
  const note = { content };

  return (
    !isShipmentStatusHistoryNote(note) &&
    !isOrderUpdateNote(note) &&
    !isOrderStatusHistoryNote(note) &&
    !isInvoiceActivityNote(note) &&
    !/^Shipment updated:/i.test(content.trim()) &&
    !/^Replacement (request created|updated):/i.test(content.trim())
  );
}

function isOrderUpdateNote(note: { content: string }): boolean {
  return note.content.startsWith('Order updated:');
}

function isOrderStatusHistoryNote(note: { content: string }): boolean {
  return (
    !isShipmentStatusHistoryNote(note) &&
    !isOrderUpdateNote(note) &&
    /status\s*(changed|:)|\bstatus\b.*->/i.test(note.content)
  );
}

function isInvoiceActivityNote(note: { content: string }): boolean {
  return Boolean(getInvoiceActivityLabel(note.content));
}

function getInvoiceActivityLabel(content: string): string | null {
  const trimmedContent = content.trim();

  if (/^Invoice generated:/i.test(trimmedContent)) {
    return 'Invoice generated';
  }

  if (/^Invoice signature request sent:/i.test(trimmedContent)) {
    return 'Invoice signature request sent';
  }

  if (/^Invoice signature request resent:/i.test(trimmedContent)) {
    return 'Invoice signature request resent';
  }

  if (/^Invoice updated:/i.test(trimmedContent)) {
    return 'Invoice updated';
  }

  if (/^Signed invoice cloned and signature request sent:/i.test(trimmedContent)) {
    return 'Signed invoice cloned';
  }

  return null;
}

function formatInvoiceActivityBody(content: string): string {
  return content.replace(/^([^:]+):\s*/i, '').trim();
}

function formatOrderHistoryBody(content: string): string {
  return content.replace(/^Order updated:\s*/i, '').trim();
}

function formatShipmentStatusHistoryBody(content: string): string {
  return content.replace(/^Shipment status updated:\s*/i, '').trim();
}

function formatNullableCurrency(value: number | null, currency = 'USD'): string {
  return value === null ? 'Not provided' : formatCurrency(value, currency);
}

function formatNullableText(value: string | null): string {
  return value?.trim() ? value : 'Not provided';
}

function isShipmentStatusHistoryNote(note: { content: string }): boolean {
  return note.content.startsWith('Shipment status updated:');
}
