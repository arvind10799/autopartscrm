'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Eye,
  History,
  LoaderCircle,
  MessageSquarePlus,
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
import type { NoteRecord } from '@/features/notes/types/note.types';
import { useOrderDetailWithRefresh } from '@/features/orders/hooks/useOrderDetail';
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
  getDefaultNextShipmentStatus,
} from '../lib/shipments.helpers';
import type { ShipmentDetail, ShipmentStatus } from '../types/shipment.types';
import { GrossProfitSummaryCard } from './GrossProfitSummaryCard';
import { ShipmentDetailGrid } from './ShipmentDetailGrid';
import { ShipmentStatusUpdateCard } from './ShipmentStatusUpdateCard';

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
  const [proNumber, setProNumber] = useState('');
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);

  useEffect(() => {
    if (!shipment) {
      setSelectedStatus('');
      setProNumber('');
      return;
    }

    setSelectedStatus(getDefaultNextShipmentStatus(shipment.currentStatus) ?? '');
    setProNumber('');
  }, [shipment]);

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

  const nextStatuses = getAllowedNextShipmentStatuses(shipment.currentStatus);
  const shipmentCost = shipment.costs[0] ?? null;
  const canAddAdditionalCost =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const canEditGpCosts =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';

  const handleStatusSubmit = async () => {
    if (!selectedStatus) {
      return;
    }

    await updateStatus(selectedStatus, proNumber);
    setOrderRefreshKey((currentValue) => currentValue + 1);
  };

  const handleStatusChange = (status: ShipmentStatus) => {
    clearStatusError();
    setSelectedStatus(status);
    setProNumber('');
  };

  return (
    <section className="grid gap-6">
      {invoiceOrder ? (
        <InvoiceActions
          order={invoiceOrder}
          onInvoiceCreated={() =>
            setOrderRefreshKey((currentValue) => currentValue + 1)
          }
          backLink={{
            href: '/shipments',
            label: 'Back to shipments',
          }}
        />
      ) : (
        <Card>
          <CardHeader className="space-y-3">
            <Link
              href="/shipments"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit px-0')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to shipments
            </Link>
            <CardTitle className="text-2xl">Invoice Management</CardTitle>
            <CardDescription>
              {isInvoiceOrderLoading
                ? 'Loading invoice management...'
                : invoiceOrderError ?? 'Invoice management is unavailable.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6">
          <GrossProfitSummaryCard
            shipmentId={shipment.id}
            totalSaleAmount={shipment.order.totalSaleAmount ?? 0}
            currency={shipment.order.currency}
            cost={shipmentCost}
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

          <ShipmentDetailGrid
            shipment={shipment}
            action={
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!invoiceOrder}
                  onClick={() => setIsOrderDetailsOpen(true)}
                >
                  <Eye className="h-4 w-4" />
                  View full order details
                </Button>
                <Button type="button" variant="outline" size="sm" disabled>
                  Cancellation
                </Button>
                <Button type="button" variant="outline" size="sm" disabled>
                  Refund
                </Button>
              </div>
            }
          />

          <ShipmentNotesHistoryCard
            shipment={shipment}
            orderNotes={invoiceOrder?.notes ?? []}
            isOrderNotesLoading={isInvoiceOrderLoading}
          />
        </div>

        <div className="grid gap-6">
          <ShipmentStatusUpdateCard
            nextStatuses={nextStatuses}
            selectedStatus={selectedStatus}
            isUpdatingStatus={isUpdatingStatus}
            statusError={statusError}
            proNumber={proNumber}
            requiresProNumber={
              selectedStatus === 'IN_TRANSIT' && !shipment.proNumber
            }
            onStatusChange={handleStatusChange}
            onProNumberChange={(value) => {
              clearStatusError();
              setProNumber(value);
            }}
            onSubmit={handleStatusSubmit}
          />

          <ShipmentStatusHistoryCard
            shipment={shipment}
            notes={invoiceOrder?.notes ?? []}
            isLoading={isInvoiceOrderLoading}
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
  const paidAmount =
    order.status === 'CONFIRMED'
      ? order.totalSaleAmount
      : intake.partialPayment ?? 0;
  const remainingAmount =
    order.status === 'CONFIRMED'
      ? 0
      : Math.max(order.totalSaleAmount - paidAmount, 0);

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
              value={formatCurrency(paidAmount, order.currency)}
            />
            <CompactDetail
              label="Remaining amount"
              value={formatCurrency(remainingAmount, order.currency)}
            />
          </CompactOrderSection>

          <CompactOrderSection title="Vehicle / Part">
            <CompactDetail label="Part" value={order.partDescription} wide />
            <CompactDetail label="Make" value={formatNullableText(intake.vehicleMake)} />
            <CompactDetail label="Model" value={formatNullableText(intake.vehicleModel)} />
            <CompactDetail label="Year" value={formatNullableText(intake.vehicleYear)} />
            <CompactDetail label="Variant" value={formatNullableText(intake.vehicleVariant)} />
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

function ShipmentNotesHistoryCard({
  shipment,
  orderNotes,
  isOrderNotesLoading,
}: {
  shipment: ShipmentDetail;
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
  const timelineEntries: ShipmentActivityEntry[] = [
    ...notes.map((note) => ({
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
        body: note.content,
      })),
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
    ...shipment.costHistories.map((history) => ({
      id: history.id,
      timestamp: history.createdAt,
      authorName: history.createdBy.name,
      label: 'GP edit',
      badgeVariant: 'success' as const,
      body: history.summary,
    })),
  ].sort(
    (firstEntry, secondEntry) =>
      new Date(secondEntry.timestamp).getTime() -
      new Date(firstEntry.timestamp).getTime(),
  );

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
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <History className="h-5 w-5 text-primary" />
              Notes & Edit History
            </CardTitle>
            <CardDescription className="text-xs">
              All order notes, shipment notes, edit history, status updates, and GP changes.
            </CardDescription>
          </div>
          <Button
            type="button"
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
      <CardContent className="space-y-3">
        {isAddNoteOpen ? (
          <form
            className="space-y-2.5 rounded-2xl border border-border/70 bg-secondary/20 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddNoteSubmit();
            }}
          >
            <label
              htmlFor="shipment-detail-note"
              className="text-sm font-semibold text-foreground"
            >
              New shipment note
            </label>
            <textarea
              id="shipment-detail-note"
              value={noteMessage}
              rows={3}
              onChange={(event) => setNoteMessage(event.target.value)}
              placeholder="Add a shipping update, carrier note, or handoff detail."
              className={cn(
                'w-full rounded-2xl border border-input bg-white/90 px-4 py-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                noteError ? 'border-destructive/60' : null,
              )}
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

        {notesError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {notesError}
          </div>
        ) : null}

        {isLoadingNotes || isOrderNotesLoading ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            Loading notes and edit history...
          </div>
        ) : timelineEntries.length > 0 ? (
          <div className="space-y-2">
            {timelineEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-border/70 bg-background/85 px-3 py-2.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {entry.authorName}
                      <span className="mx-1.5 text-muted-foreground">|</span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {formatDateTime(entry.timestamp)} ({formatRelativeTime(entry.timestamp)})
                      </span>
                    </p>
                  </div>
                  <Badge
                    variant={entry.badgeVariant}
                    className="h-5 shrink-0 rounded-full px-2 text-[11px]"
                  >
                    {entry.label}
                  </Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
                  {entry.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            No notes or edit history has been recorded yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShipmentStatusHistoryCard({
  shipment,
  notes,
  isLoading,
}: {
  shipment: ShipmentDetail;
  notes: OrderNote[];
  isLoading: boolean;
}) {
  const statusNotes = notes
    .filter(isShipmentStatusHistoryNote)
    .sort(
      (firstNote, secondNote) =>
        new Date(secondNote.createdAt).getTime() -
        new Date(firstNote.createdAt).getTime(),
    );
  const latestNote = statusNotes[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <History className="h-5 w-5 text-primary" />
          Last Status Update
        </CardTitle>
        <CardDescription>
          {latestNote
            ? `${latestNote.author.name} · ${formatDateTime(latestNote.createdAt)}`
            : isLoading
              ? 'Loading status history...'
              : `Current status: ${formatShipmentStatusOptionLabel(
                  shipment.currentStatus,
                )}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {statusNotes.length > 0 ? (
          <div className="space-y-3">
            {statusNotes.slice(0, 6).map((note) => (
              <div
                key={note.id}
                className="rounded-2xl border border-border/70 bg-secondary/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">Shipment status</Badge>
                  <span className="text-xs text-muted-foreground">
                    {note.author.name} | {formatDateTime(note.createdAt)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                  {formatShipmentStatusHistoryBody(note.content)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            No shipment status history has been recorded yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function isShipmentStatusHistoryNote(note: OrderNote): boolean {
  return note.content.startsWith('Shipment status updated:');
}

function isOrderUpdateNote(note: OrderNote): boolean {
  return note.content.startsWith('Order updated:');
}

function isOrderStatusHistoryNote(note: OrderNote): boolean {
  return (
    !isShipmentStatusHistoryNote(note) &&
    !isOrderUpdateNote(note) &&
    /status\s*(changed|:)|\bstatus\b.*->/i.test(note.content)
  );
}

function isPlainOrderNote(note: OrderNote): boolean {
  return (
    !isShipmentStatusHistoryNote(note) &&
    !isOrderUpdateNote(note) &&
    !isOrderStatusHistoryNote(note)
  );
}

function formatOrderHistoryBody(content: string): string {
  return content.replace(/^Order updated:\s*/i, '').trim();
}

function formatShipmentStatusHistoryBody(content: string): string {
  return content.replace(/^Shipment status updated:\s*/i, '').trim();
}
