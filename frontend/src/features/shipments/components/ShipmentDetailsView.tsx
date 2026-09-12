'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  History,
  LoaderCircle,
  Plus,
  X,
} from 'lucide-react';
import { DetailPageSkeleton } from '@/components/feedback/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { InvoiceActions } from '@/features/invoices/components/InvoiceActions';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { notesApi } from '@/features/notes/api/notes-api';
import { ReplacementTracker } from '@/features/replacements/components/ReplacementTracker';
import {
  OrderResolutionActions,
  OrderResolutionDetails,
} from '@/features/orders/components/OrderResolutionActions';
import type { NoteRecord } from '@/features/notes/types/note.types';
import { useOrderDetailWithRefresh } from '@/features/orders/hooks/useOrderDetail';
import { getOrderFinancialSummary } from '@/features/orders/lib/order-financials';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatOrderPaymentMethod,
  formatOrderStatus,
  formatRelativeTime,
} from '@/features/orders/lib/order-formatters';
import type { OrderDetail, OrderNote } from '@/features/orders/types/order.types';
import { useShipmentDetail } from '../hooks/useShipmentDetail';
import {
  formatShipmentStatusOptionLabel,
  getAllowedNextShipmentStatuses,
} from '../lib/shipments.helpers';
import {
  SHIPMENT_STATUSES,
  type ShipmentDetail,
  type ShipmentStatus,
} from '../types/shipment.types';
import { GrossProfitSummaryCard } from './GrossProfitSummaryCard';
import { ShipmentDetailGrid } from './ShipmentDetailGrid';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';
import { ShipmentStatusUpdateCard } from './ShipmentStatusUpdateCard';

const SHIPMENT_DETAIL_ALLOWED_NEXT_STATUSES = ['IN_TRANSIT', 'DELIVERED'] as const;

type ShipmentActivityEntry = {
  id: string;
  timestamp: string;
  authorName: string;
  label: string;
  badgeVariant:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';
  body: ReactNode;
};

export function ShipmentDetailsView({ shipmentId }: { shipmentId: string }) {
  const {
    shipment,
    isLoading,
    error,
    isUpdatingStatus,
    statusError,
    clearStatusError,
    refreshShipment,
    updateStatus,
  } = useShipmentDetail(shipmentId);
  const authUser = useAuthStore((state) => state.user);
  const [orderRefreshKey, setOrderRefreshKey] = useState(0);
  const {
    order: invoiceOrder,
    isLoading: isInvoiceOrderLoading,
    error: invoiceOrderError,
  } = useOrderDetailWithRefresh(shipment?.orderId ?? '', orderRefreshKey);
  const [selectedStatus, setSelectedStatus] = useState<ShipmentStatus | ''>('');
  const [bolNumber, setBolNumber] = useState('');
  const [pickupNumber, setPickupNumber] = useState('');
  const [proNumber, setProNumber] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const canOverrideShipment =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';

  useEffect(() => {
    if (!shipment) {
      setSelectedStatus('');
      setBolNumber('');
      setPickupNumber('');
      setProNumber('');
      setCarrierName('');
      return;
    }

    setSelectedStatus(
      canOverrideShipment
        ? shipment.currentStatus
        : getShipmentDetailNextStatuses(shipment.currentStatus)[0] ?? '',
    );
    setBolNumber(shipment.bolNumber ?? '');
    setPickupNumber(shipment.pickupNumber ?? '');
    setProNumber(shipment.proNumber ?? '');
    setCarrierName(shipment.carrierName ?? '');
  }, [canOverrideShipment, shipment]);

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !shipment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Shipment details</CardTitle>
          <CardDescription>
            The requested shipment could not be loaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'Shipment details are unavailable.'}
          </div>
          <Link
            href="/shipments"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to shipments
          </Link>
        </CardContent>
      </Card>
    );
  }

  const nextStatuses = canOverrideShipment
    ? [...SHIPMENT_STATUSES]
    : getShipmentDetailNextStatuses(shipment.currentStatus);
  const resolvedOrderStatus = invoiceOrder?.status ?? shipment.order.status;
  const isOrderResolvedForShipment =
    resolvedOrderStatus === 'CANCELLED' || resolvedOrderStatus === 'REFUNDED';
  const statusLockedReason = isOrderResolvedForShipment
    ? `Status updates are disabled because this order is ${formatOrderStatus(
        resolvedOrderStatus,
      )}.`
    : null;
  const shipmentCost = shipment.costs[0] ?? null;
  const canAddAdditionalCost =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const canEditGpCosts =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const canCreateReplacementFromShipment =
    canAddAdditionalCost &&
    shipment.currentStatus === 'DELIVERED' &&
    resolvedOrderStatus !== 'REFUNDED';
  const shipmentFinancialSummary = invoiceOrder
    ? getOrderFinancialSummary(invoiceOrder)
    : null;
  const gpCard = (
    <GrossProfitSummaryCard
      shipmentId={shipment.id}
      totalSaleAmount={
        shipmentFinancialSummary?.gpSaleBasis ??
        shipment.order.totalSaleAmount ??
        0
      }
      originalSaleAmount={
        invoiceOrder?.totalSaleAmount ?? shipment.order.totalSaleAmount ?? 0
      }
      currency={shipment.order.currency}
      cost={shipmentCost}
      saleMetricLabel={invoiceOrder?.status === 'REFUNDED' ? 'Refund retained' : 'Sale'}
      paymentProcessingFee={shipmentFinancialSummary?.paymentProcessingFee}
      grossProfitOverride={shipmentFinancialSummary?.grossProfitOverride}
      refundDetails={
        invoiceOrder?.status === 'REFUNDED'
          ? {
              refundType: invoiceOrder.intakeDetails.refundType,
              refundDeductionAmount:
                invoiceOrder.intakeDetails.refundDeductionAmount,
              refundDeductionReason:
                invoiceOrder.intakeDetails.refundDeductionReason,
              customerRefundedAmount:
                shipmentFinancialSummary?.refundedAmount ?? 0,
              refundedAt: invoiceOrder.intakeDetails.refundedAt,
            }
          : null
      }
      additionalCosts={shipment.additionalCosts}
      costHistories={shipment.costHistories}
      canAddAdditionalCost={canAddAdditionalCost}
      canEditBaseCost={canEditGpCosts}
      canEditAdditionalCosts={canEditGpCosts}
      onAdditionalCostAdded={async () => {
        await refreshShipment();
        setOrderRefreshKey((currentValue) => currentValue + 1);
      }}
      onCostUpdated={async () => {
        await refreshShipment();
        setOrderRefreshKey((currentValue) => currentValue + 1);
      }}
    />
  );

  const handleStatusSubmit = async () => {
    if (isOrderResolvedForShipment) {
      return;
    }

    if (!selectedStatus) {
      return;
    }

    await updateStatus(selectedStatus, {
      bolNumber,
      pickupNumber,
      proNumber,
      carrierName,
    });
    setOrderRefreshKey((currentValue) => currentValue + 1);
  };

  const handleStatusChange = (status: ShipmentStatus) => {
    clearStatusError();
    setSelectedStatus(status);
    if (!canOverrideShipment) {
      setProNumber('');
    }
  };

  return (
    <section className="grid gap-5">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        {invoiceOrder ? (
          <InvoiceActions
            order={invoiceOrder}
            onInvoiceCreated={() =>
              setOrderRefreshKey((currentValue) => currentValue + 1)
            }
          />
        ) : (
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-base">Invoice Management</CardTitle>
              <CardDescription className="text-xs">
                {isInvoiceOrderLoading
                  ? 'Loading invoice management...'
                  : invoiceOrderError ?? 'Invoice management is unavailable.'}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {gpCard}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <div className="grid gap-5">
          <ShipmentDetailGrid
            shipment={shipment}
            action={
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs"
                  disabled={!invoiceOrder}
                  onClick={() => setIsOrderDetailsOpen(true)}
                >
                  <Eye className="h-4 w-4" />
                  View full order details
                </Button>
                {invoiceOrder ? (
                  <OrderResolutionActions
                    order={invoiceOrder}
                    onResolved={async () => {
                      await refreshShipment();
                      setOrderRefreshKey((currentValue) => currentValue + 1);
                    }}
                  />
                ) : null}
                {invoiceOrder && canCreateReplacementFromShipment ? (
                  <ReplacementTracker
                    orderId={invoiceOrder.id}
                    shipmentId={shipment.id}
                    buttonOnly
                    onChanged={async () => {
                      await refreshShipment();
                      setOrderRefreshKey((currentValue) => currentValue + 1);
                    }}
                  />
                ) : null}
              </div>
            }
          />

          {invoiceOrder ? <OrderResolutionDetails order={invoiceOrder} /> : null}

          <ShipmentStatusUpdateCard
            nextStatuses={nextStatuses}
            selectedStatus={selectedStatus}
            isUpdatingStatus={isUpdatingStatus}
            statusError={statusError}
            bolNumber={bolNumber}
            pickupNumber={pickupNumber}
            proNumber={proNumber}
            carrierName={carrierName}
            isAdminOverride={canOverrideShipment}
            requiresBolNumber={false}
            requiresCarrierName={
              selectedStatus === 'SHIPPED' && !carrierName.trim()
            }
            requiresProNumber={
              selectedStatus === 'IN_TRANSIT' &&
              (canOverrideShipment ? !proNumber.trim() : !shipment.proNumber)
            }
            lockedReason={statusLockedReason}
            onStatusChange={handleStatusChange}
            onBolNumberChange={(value) => {
              clearStatusError();
              setBolNumber(value);
            }}
            onPickupNumberChange={(value) => {
              clearStatusError();
              setPickupNumber(value);
            }}
            onProNumberChange={(value) => {
              clearStatusError();
              setProNumber(value);
            }}
            onCarrierNameChange={(value) => {
              clearStatusError();
              setCarrierName(value);
            }}
            onSubmit={handleStatusSubmit}
          />
        </div>

        <div className="grid gap-5 xl:sticky xl:top-6 xl:self-start">
          <ShipmentNotesHistoryCard
            shipment={shipment}
            order={invoiceOrder}
            orderNotes={invoiceOrder?.notes ?? []}
            isOrderNotesLoading={isInvoiceOrderLoading}
          />
        </div>
      </div>

      {isOrderDetailsOpen && invoiceOrder ? (
        <FullOrderDetailsModal
          order={invoiceOrder}
          onClose={() => setIsOrderDetailsOpen(false)}
        />
      ) : null}
    </section>
  );
}

function FullOrderDetailsModal({
  order,
  onClose,
}: {
  order: OrderDetail;
  onClose: () => void;
}) {
  const intake = order.intakeDetails;
  const financialSummary = getOrderFinancialSummary(order);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-950/20 dark:border-slate-800 dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-semibold text-foreground">
              Full Order Details
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.orderNumber} · {order.customerName}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="grid max-h-[78vh] gap-4 overflow-auto pr-1 lg:grid-cols-2">
          <CompactOrderSection title="Customer / Contact">
            <CompactDetail label="Customer" value={order.customerName} />
            <CompactDetail label="Phone" value={order.customerPhone ?? 'Not provided'} />
            <CompactDetail label="Email" value={order.customerEmail ?? 'Not provided'} wide />
          </CompactOrderSection>

          <CompactOrderSection title="Order / Payment">
            <CompactDetail label="Order number" value={order.orderNumber} />
            <CompactDetail
              label="Sales Number"
              value={order.salesNumber ?? 'Not provided'}
            />
            <CompactDetail
              label="Order date"
              value={intake.orderDate ? formatDate(intake.orderDate) : 'Not provided'}
            />
            <CompactDetail
              label="Advisor"
              value={intake.advisorName ?? order.createdBy.name}
            />
            <CompactDetail label="Status" value={formatOrderStatus(order.status)} />
            <CompactDetail
              label="Payment method"
              value={
                order.paymentMethod
                  ? formatOrderPaymentMethod(order.paymentMethod)
                  : 'Not required'
              }
            />
            <CompactDetail
              label="Total"
              value={formatCurrency(order.totalSaleAmount, order.currency)}
            />
            <CompactDetail
              label="Paid"
              value={formatCurrency(financialSummary.retainedPaidAmount, order.currency)}
            />
            <CompactDetail
              label="Remaining amount"
              value={formatCurrency(financialSummary.remainingAmount, order.currency)}
            />
          </CompactOrderSection>

          <CompactOrderSection title="Vehicle / Part">
            <CompactDetail label="Part" value={order.partDescription} wide />
            <CompactDetail label="Make" value={formatNullableText(intake.vehicleMake)} />
            <CompactDetail label="Model" value={formatNullableText(intake.vehicleModel)} />
            <CompactDetail label="Year" value={formatNullableText(intake.vehicleYear)} />
            <CompactDetail label="Part" value={formatNullableText(intake.vehicleVariant)} />
            <CompactDetail label="VIN" value={formatNullableText(intake.vehicleVin)} />
            <CompactDetail
              label="Miles offered"
              value={formatNullableText(intake.milesOffered)}
            />
            <CompactDetail
              label="Part description"
              value={formatNullableText(intake.vehicleNotes)}
              wide
            />
          </CompactOrderSection>

          <CompactOrderSection title="Billing / Shipping">
            <CompactDetail
              label="Billing address"
              value={formatNullableText(intake.billingAddress)}
              wide
            />
            <CompactDetail label="Billing person" value={formatNullableText(intake.billingPerson)} />
            <CompactDetail label="Billing phone" value={formatNullableText(intake.billingPhone)} />
            <CompactDetail
              label="Shipping address"
              value={
                <ShippingAddressValue
                  businessName={intake.companyName}
                  shippingAddress={intake.shippingAddress}
                />
              }
              wide
            />
            <CompactDetail label="Shipping person" value={formatNullableText(intake.shippingPerson)} />
            <CompactDetail label="Shipping phone" value={formatNullableText(intake.shippingPhone)} />
          </CompactOrderSection>

          <OrderResolutionDetails order={order} className="lg:col-span-2" />
        </div>
      </div>
    </div>
  );
}

function CompactOrderSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/70 bg-secondary/15 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function CompactDetail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-background/80 p-3',
        wide && 'sm:col-span-2',
      )}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 break-words text-sm leading-6 text-foreground">
        {value}
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
        <p className="whitespace-pre-wrap text-foreground">
          {trimmedShippingAddress}
        </p>
      ) : null}
    </div>
  );
}

function formatNullableText(value?: string | null): string {
  return value?.trim() ? value : 'Not provided';
}

function getShipmentDetailNextStatuses(
  status: ShipmentStatus,
): ShipmentStatus[] {
  return getAllowedNextShipmentStatuses(status).filter((nextStatus) =>
    SHIPMENT_DETAIL_ALLOWED_NEXT_STATUSES.includes(
      nextStatus as (typeof SHIPMENT_DETAIL_ALLOWED_NEXT_STATUSES)[number],
    ),
  );
}

function ShipmentNotesHistoryCard({
  shipment,
  order,
  orderNotes,
  isOrderNotesLoading,
}: {
  shipment: ShipmentDetail;
  order?: OrderDetail | null;
  orderNotes: OrderNote[];
  isOrderNotesLoading: boolean;
}) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const noteEntries: ShipmentActivityEntry[] = [
    ...notes
      .filter((note) => isPlainUserNoteContent(note.message))
      .map((note) => ({
        id: note.id,
        timestamp: note.createdAt,
        authorName: note.author.name,
        label: 'Shipment note',
        badgeVariant: 'secondary' as const,
        body: note.message,
      })),
    ...orderNotes
      .filter(isPlainOrderNote)
      .map((note) => ({
        id: note.id,
        timestamp: note.createdAt,
        authorName: note.author.name,
        label: 'Order note',
        badgeVariant: 'neutral' as const,
        body: formatOrderNoteBody(note.content, order, shipment),
      })),
  ].sort(compareShipmentActivityEntriesDesc);
  const editHistoryEntries: ShipmentActivityEntry[] = [
    ...orderNotes
      .filter(isOrderUpdateNote)
      .map((note) => ({
        id: note.id,
        timestamp: note.createdAt,
        authorName: note.author.name,
        label: 'Order edit',
        badgeVariant: 'info' as const,
        body: formatOrderHistoryBody(note.content),
      })),
    ...orderNotes
      .filter(isInvoiceActivityNote)
      .map((note) => ({
        id: note.id,
        timestamp: note.createdAt,
        authorName: note.author.name,
        label: getInvoiceActivityLabel(note.content) ?? 'Invoice activity',
        badgeVariant: 'info' as const,
        body: formatInvoiceActivityBody(note.content),
      })),
    ...shipment.costHistories.map((history) => ({
      id: history.id,
      timestamp: history.createdAt,
      authorName: history.createdBy.name,
      label: 'GP edit',
      badgeVariant: 'success' as const,
      body: history.summary,
    })),
  ].sort(compareShipmentActivityEntriesDesc);
  const statusHistoryEntries: ShipmentActivityEntry[] = [
    ...orderNotes
      .filter(isOrderStatusHistoryNote)
      .map((note) => ({
        id: note.id,
        timestamp: note.createdAt,
        authorName: note.author.name,
        label: 'Order status',
        badgeVariant: 'warning' as const,
        body: formatOrderHistoryBody(note.content),
      })),
    ...orderNotes.filter(isShipmentStatusHistoryNote).map((note) => ({
      id: note.id,
      timestamp: note.createdAt,
      authorName: note.author.name,
      label: 'Status change',
      badgeVariant: 'warning' as const,
      body: formatShipmentStatusHistoryBody(note.content),
    })),
  ].sort(compareShipmentActivityEntriesDesc);

  useEffect(() => {
    let isMounted = true;

    const loadNotes = async () => {
      setIsLoadingNotes(true);
      setNotesError(null);

      try {
        const loadedNotes = await notesApi.listByEntity('SHIPMENT', shipment.id);

        if (isMounted) {
          setNotes(loadedNotes);
        }
      } catch (error) {
        if (isMounted) {
          setNotesError(
            error instanceof Error
              ? error.message
              : 'Unable to load shipment notes.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingNotes(false);
        }
      }
    };

    void loadNotes();

    return () => {
      isMounted = false;
    };
  }, [shipment.id]);

  const handleAddNoteSubmit = async () => {
    const trimmedMessage = noteMessage.trim();

    if (!trimmedMessage) {
      setNoteError('Note message is required.');
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);

    try {
      const createdNote = await notesApi.create({
        entityType: 'SHIPMENT',
        entityId: shipment.id,
        message: trimmedMessage,
      });
      setNotes((currentNotes) => [createdNote, ...currentNotes]);
      setNoteMessage('');
      setIsAddNoteOpen(false);
    } catch (error) {
      setNoteError(
        error instanceof Error
          ? error.message
          : 'Unable to add this shipment note right now.',
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm xl:flex xl:max-h-[calc(100vh-3rem)] xl:flex-col">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-4 w-4 text-primary" />
              NOTES
            </CardTitle>
          </div>
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
              htmlFor="shipment-detail-note"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Add note
            </label>
            <textarea
              id="shipment-detail-note"
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

        {notesError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {notesError}
          </div>
        ) : null}

        {isLoadingNotes || isOrderNotesLoading ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
            Loading notes and edit history...
          </div>
        ) : (
          <>
            <ShipmentActivityTimeline
              entries={noteEntries}
              emptyMessage="No internal notes yet."
            />
            <ShipmentTimelineGroup
              title="Edit History Timeline"
              entries={editHistoryEntries}
              emptyMessage="No edit history has been recorded yet."
            />
            <ShipmentTimelineGroup
              title="Status Change History"
              entries={statusHistoryEntries}
              emptyMessage="No status changes have been recorded yet."
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ShipmentTimelineGroup({
  title,
  entries,
  emptyMessage,
}: {
  title: string;
  entries: ShipmentActivityEntry[];
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
        <ShipmentActivityTimeline
          entries={entries}
          emptyMessage={emptyMessage}
          showBadges
        />
      </div>
    </details>
  );
}

function ShipmentActivityTimeline({
  entries,
  emptyMessage,
  showBadges = false,
}: {
  entries: ShipmentActivityEntry[];
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
        <ShipmentActivityItem
          key={entry.id}
          entry={entry}
          showBadge={showBadges}
        />
      ))}
    </ol>
  );
}

function ShipmentActivityItem({
  entry,
  showBadge,
}: {
  entry: ShipmentActivityEntry;
  showBadge: boolean;
}) {
  return (
    <li className="relative pl-6">
      <span
        className={cn(
          'absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background',
          getShipmentTimelineDotClassName(entry.badgeVariant),
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
            {entry.authorName}
          </span>{' '}
          | {formatDateTime(entry.timestamp)} ({formatRelativeTime(entry.timestamp)})
        </p>
        {showBadge ? (
          <Badge
            variant={entry.badgeVariant}
            className="h-5 rounded-md px-2 text-[10px]"
          >
            {entry.label}
          </Badge>
        ) : null}
        <div className="whitespace-pre-wrap text-xs font-medium leading-5 text-foreground">
          {entry.body}
        </div>
      </div>
    </li>
  );
}

function compareShipmentActivityEntriesDesc(
  firstEntry: ShipmentActivityEntry,
  secondEntry: ShipmentActivityEntry,
) {
  return (
    new Date(secondEntry.timestamp).getTime() -
    new Date(firstEntry.timestamp).getTime()
  );
}

function getShipmentTimelineDotClassName(
  variant?: ShipmentActivityEntry['badgeVariant'],
) {
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

function isShipmentStatusHistoryNote(note: { content: string }): boolean {
  return note.content.startsWith('Shipment status updated:');
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

function isPlainOrderNote(note: OrderNote): boolean {
  return isPlainUserNoteContent(note.content);
}

function isPlainUserNoteContent(content: string): boolean {
  const trimmedContent = content.trim();
  const note = { content };

  return (
    !isShipmentStatusHistoryNote(note) &&
    !isOrderUpdateNote(note) &&
    !isOrderStatusHistoryNote(note) &&
    !isInvoiceActivityNote(note) &&
    !/^Shipment updated:/i.test(trimmedContent) &&
    !/^Replacement (request created|updated):/i.test(trimmedContent)
  );
}

function formatOrderHistoryBody(content: string): string {
  return content.replace(/^Order updated:\s*/i, '').trim();
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

function formatOrderNoteBody(
  content: string,
  order: OrderDetail | null | undefined,
  shipment: ShipmentDetail,
): string {
  const trimmedContent = content.trim();

  if (!/^Order refunded:/i.test(trimmedContent)) {
    return trimmedContent;
  }

  return trimmedContent.replace(
    /- GP adjusted to \$0\.00/i,
    `- GP: ${formatCurrency(calculateShipmentActualGp(order, shipment), shipment.order.currency)}`,
  );
}

function calculateShipmentActualGp(
  order: OrderDetail | null | undefined,
  shipment: ShipmentDetail,
): number {
  const retainedAmount = order
    ? getOrderFinancialSummary(order).gpSaleBasis
    : shipment.order.status === 'REFUNDED'
      ? 0
      : shipment.order.totalSaleAmount ?? 0;
  const cost = shipment.costs[0] ?? null;
  const additionalAmount =
    shipment.additionalCosts.length > 0
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

  return retainedAmount - totalCosts;
}

function formatShipmentStatusHistoryBody(content: string): string {
  return content.replace(/^Shipment status updated:\s*/i, '').trim();
}
