'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  History,
  LoaderCircle,
  MessageSquarePlus,
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
import { notesApi } from '@/features/notes/api/notes-api';
import { InvoiceActions } from '@/features/invoices/components/InvoiceActions';
import { ShipmentStatusBadge } from '@/features/shipments/components/ShipmentStatusBadge';
import { formatShipmentStatus } from '@/features/shipments/lib/shipment-formatters';
import { toast } from '@/lib/stores/toast.store';
import { cn } from '@/lib/utils/cn';
import { useOrderDetailWithRefresh } from '../hooks/useOrderDetail';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatOrderPaymentMethod,
  formatOrderStatus,
} from '../lib/order-formatters';
import type {
  OrderDetail,
  OrderNote,
  OrderShipment,
  OrderShipmentStatus,
  OrderStatus,
} from '../types/order.types';

type TimelineEntry = {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  body: ReactNode;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
};

export function OrderDetailsView({ orderId }: { orderId: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const { order, isLoading, error } = useOrderDetailWithRefresh(orderId, refreshKey);

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
        entityId: orderId,
        message: trimmedMessage,
      });
      setNoteMessage('');
      setIsAddNoteOpen(false);
      setRefreshKey((currentValue) => currentValue + 1);
      toast.success('Note added', 'The order activity panel has been refreshed.');
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

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !order) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Order details</CardTitle>
          <CardDescription>
            The requested order could not be loaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'Order details are unavailable.'}
          </div>
          <Link
            href="/orders"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>
        </CardContent>
      </Card>
    );
  }

  const intake = order.intakeDetails;
  const paidNowAmount =
    order.status === 'CONFIRMED'
      ? order.totalSaleAmount
      : intake.partialPayment ?? 0;
  const balanceAmount =
    order.status === 'CONFIRMED'
      ? 0
      : Math.max(order.totalSaleAmount - paidNowAmount, 0);
  const notesTimeline = buildNoteTimeline(order.notes);
  const editHistoryTimeline = buildEditHistoryTimeline(order.notes);
  const statusTimeline = buildStatusTimeline(order);
  const shipmentTimeline = buildShipmentTimeline(order.shipments);

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <Link
            href="/orders"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit px-0')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="break-words text-3xl sm:text-[2rem]">
                  {order.orderNumber}
                </CardTitle>
                <OrderStatusBadge status={order.status} />
              </div>
              <CardDescription>
                {order.customerName} ordered {order.partDescription}.
              </CardDescription>
            </div>

            <div className="rounded-2xl border border-border/70 bg-primary/5 px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Total amount
              </p>
              <p className="mt-2 font-[var(--font-heading)] text-2xl font-semibold tabular-nums text-foreground sm:text-[1.75rem]">
                {formatCurrency(order.totalSaleAmount)}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <InvoiceActions
        order={order}
        onInvoiceCreated={() => setRefreshKey((currentValue) => currentValue + 1)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] xl:grid-cols-[minmax(0,7fr)_minmax(340px,3fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl sm:text-[1.75rem]">Order details</CardTitle>
              <CardDescription>
                Compact order, customer, vehicle, pricing, billing, and shipping details.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <DetailSection title="Basic Order Info">
                <DetailBlock label="Order number" value={order.orderNumber} />
                <DetailBlock
                  label="Advisor name"
                  value={intake.advisorName ?? order.createdBy.name}
                />
                <DetailBlock
                  label="Date"
                  value={intake.orderDate ? formatDate(intake.orderDate) : 'Not provided'}
                />
              </DetailSection>

              <DetailSection title="Customer Info">
                <DetailBlock label="Name" value={order.customerName} />
                <DetailBlock
                  label="Mobile"
                  value={order.customerPhone ?? 'Not provided'}
                />
                <DetailBlock
                  label="Email"
                  value={order.customerEmail ?? 'Not provided'}
                />
              </DetailSection>

              <DetailSection title="Vehicle / Part Info">
                <DetailBlock label="Parts" value={order.partDescription} />
                <DetailBlock label="Make" value={intake.vehicleMake ?? 'Not provided'} />
                <DetailBlock label="Model" value={intake.vehicleModel ?? 'Not provided'} />
                <DetailBlock label="Year" value={intake.vehicleYear ?? 'Not provided'} />
                <DetailBlock label="Variant" value={intake.vehicleVariant ?? 'Not provided'} />
                <DetailBlock label="VIN" value={intake.vehicleVin ?? 'Not provided'} />
                <DetailBlock
                  label="Vehicle notes"
                  value={intake.vehicleNotes ?? 'Not provided'}
                />
                <DetailBlock
                  label="Configuration"
                  value={intake.vehicleConfiguration ?? 'Not provided'}
                />
              </DetailSection>

              <CollapsibleDetailSection title="Billing Information">
                <DetailBlock
                  label="Billing Address"
                  value={intake.billingAddress ?? 'Not provided'}
                />
                <DetailBlock
                  label="Billing Person"
                  value={intake.billingPerson ?? 'Not provided'}
                />
                <DetailBlock
                  label="Billing Phone"
                  value={intake.billingPhone ?? 'Not provided'}
                />
              </CollapsibleDetailSection>

              <CollapsibleDetailSection title="Shipping Information">
                <DetailBlock
                  label="Shipping Address"
                  value={intake.shippingAddress ?? 'Not provided'}
                />
                <DetailBlock
                  label="Shipping Person"
                  value={intake.shippingPerson ?? 'Not provided'}
                />
                <DetailBlock
                  label="Shipping Phone"
                  value={intake.shippingPhone ?? 'Not provided'}
                />
                <DetailBlock
                  label="Shipping Date"
                  value={intake.shippingAt ? formatDate(intake.shippingAt) : 'Not provided'}
                />
                <DetailBlock
                  label="Company Name"
                  value={intake.companyName ?? 'Not provided'}
                />
                <DetailBlock
                  label="Shipping status"
                  value={
                    <ShippingStatusValue
                      shipmentCount={order.counts.shipments}
                      status={order.latestShipmentStatus}
                    />
                  }
                />
              </CollapsibleDetailSection>

              <DetailSection title="Pricing / Sales Info">
                <DetailBlock
                  label="Miles Offered"
                  value={formatNullableNumber(intake.milesOffered)}
                />
                <DetailBlock
                  label="Price Offered"
                  value={formatCurrency(order.salePrice)}
                />
                <DetailBlock
                  label="Base Price"
                  value={formatNullableCurrency(intake.basePrice)}
                />
                <DetailBlock
                  label="Sales Tax"
                  value={formatNullableCurrency(intake.salesTax)}
                />
                <DetailBlock
                  label="Shipping Charges"
                  value={formatNullableCurrency(intake.shippingCharges)}
                />
                <DetailBlock
                  label="Profit"
                  value={formatNullableCurrency(intake.profit)}
                />
                <DetailBlock label="Total" value={formatCurrency(order.totalSaleAmount)} />
                <DetailBlock
                  label="Paid"
                  value={formatCurrency(paidNowAmount)}
                />
                <DetailBlock
                  label="Balance"
                  value={formatCurrency(balanceAmount)}
                />
                <DetailBlock
                  label="Payment method"
                  value={
                    order.paymentMethod
                      ? formatOrderPaymentMethod(order.paymentMethod)
                      : 'Not required'
                  }
                />
              </DetailSection>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="lg:max-h-[calc(100vh-3rem)] lg:overflow-hidden">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <History className="h-5 w-5 text-primary" />
                    Notes & Edit History
                  </CardTitle>
                  <CardDescription>
                    Newest activity stays visible while reviewing order details.
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

            <CardContent className="space-y-5 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
              {isAddNoteOpen ? (
                <form
                  className="space-y-3 rounded-2xl border border-border/70 bg-secondary/20 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAddNoteSubmit();
                  }}
                >
                  <label
                    htmlFor="order-detail-note"
                    className="text-sm font-semibold text-foreground"
                  >
                    New note
                  </label>
                  <textarea
                    id="order-detail-note"
                    value={noteMessage}
                    rows={4}
                    onChange={(event) => setNoteMessage(event.target.value)}
                    placeholder="Add a customer update, handoff, or follow-up note."
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

              <TimelineGroup
                title="Notes Timeline"
                entries={notesTimeline}
                emptyMessage="No notes have been added yet."
              />
              <TimelineGroup
                title="Edit History Timeline"
                entries={editHistoryTimeline}
                emptyMessage="No edit history has been recorded yet."
              />
              <TimelineGroup
                title="Status Change History"
                entries={statusTimeline}
                emptyMessage="No status changes have been recorded yet."
              />
              <TimelineGroup
                title="Shipment Updates"
                entries={shipmentTimeline}
                emptyMessage="Shipment is not created yet."
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function buildNoteTimeline(notes: OrderNote[]): TimelineEntry[] {
  return notes
    .filter((note) => !isHistoryNote(note) && !isStatusHistoryNote(note))
    .map((note) => ({
      id: note.id,
      timestamp: note.createdAt,
      actorName: note.author.name,
      action: 'ADDED note',
      body: note.content,
      badgeVariant: 'secondary' as const,
    }))
    .sort(compareTimelineEntriesDesc);
}

function buildEditHistoryTimeline(notes: OrderNote[]): TimelineEntry[] {
  return notes
    .filter((note) => isHistoryNote(note) && !isStatusHistoryNote(note))
    .map((note) => ({
      id: note.id,
      timestamp: note.createdAt,
      actorName: note.author.name,
      action: 'UPDATED order',
      body: formatHistoryBody(note.content),
      badgeVariant: 'info' as const,
    }))
    .sort(compareTimelineEntriesDesc);
}

function buildStatusTimeline(order: OrderDetail): TimelineEntry[] {
  const statusHistoryEntries = order.notes
    .filter(isStatusHistoryNote)
    .map((note) => ({
      id: note.id,
      timestamp: note.createdAt,
      actorName: note.author.name,
      action: 'Status changed',
      body: formatHistoryBody(note.content),
      badgeVariant: 'warning' as const,
    }));

  return [
    ...statusHistoryEntries,
    {
      id: `${order.id}-created`,
      timestamp: order.createdAt,
      actorName: order.createdBy.name,
      action: 'Order created',
      body: `Initial status: ${formatOrderStatus(order.status)}`,
      badgeVariant: 'success' as const,
    },
  ].sort(compareTimelineEntriesDesc);
}

function buildShipmentTimeline(shipments: OrderShipment[]): TimelineEntry[] {
  return shipments
    .map((shipment) => ({
      id: shipment.id,
      timestamp: shipment.updatedAt,
      actorName: 'System',
      action: 'Shipment updated',
      body: (
        <span>
          {shipment.proNumber ?? 'PRO pending'} ·{' '}
          {shipment.carrierName ?? 'Carrier pending'} ·{' '}
          {formatShipmentStatus(shipment.status as OrderShipmentStatus)}
        </span>
      ),
      badgeVariant: 'neutral' as const,
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

function isHistoryNote(note: OrderNote): boolean {
  return note.content.startsWith('Order updated:');
}

function isStatusHistoryNote(note: OrderNote): boolean {
  return /status\s*(changed|:)|\bstatus\b.*->/i.test(note.content);
}

function formatHistoryBody(content: string): string {
  return content.replace(/^Order updated:\s*/i, '').trim();
}

function formatNullableCurrency(value: number | null): string {
  return value === null ? 'Not provided' : formatCurrency(value);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'Not provided' : String(value);
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const variantByStatus: Record<
    OrderStatus,
    'default' | 'secondary' | 'outline' | 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  > = {
    DRAFT: 'outline',
    PARTIALLY_PAID: 'warning',
    CONFIRMED: 'success',
    PROCESSING: 'info',
    SHIPPED: 'default',
    DELIVERED: 'neutral',
    CANCELLED: 'danger',
  };

  return (
    <Badge variant={variantByStatus[status]} className="text-xs">
      {formatOrderStatus(status)}
    </Badge>
  );
}

function ShippingStatusValue({
  status,
  shipmentCount,
}: {
  status: OrderShipmentStatus | null;
  shipmentCount: number;
}) {
  if (!status || shipmentCount === 0) {
    return <span className="text-sm text-muted-foreground">Shipment is not created yet</span>;
  }

  return <ShipmentStatusBadge status={status} />;
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold text-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{children}</div>
    </section>
  );
}

function CollapsibleDetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-border/70 bg-white/70 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xl font-semibold text-foreground marker:hidden">
        {title}
        <ChevronDown className="h-5 w-5 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 2xl:grid-cols-3">
        {children}
      </div>
    </details>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/20 p-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground">
        {value}
      </div>
    </div>
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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h3>
        <Badge variant="outline">{entries.length}</Badge>
      </div>

      {entries.length > 0 ? (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <TimelineItem key={entry.id} entry={entry} />
          ))}
        </ol>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="relative rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={entry.badgeVariant ?? 'secondary'}>
          {entry.action}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(entry.timestamp)}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{entry.actorName}</p>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {entry.body}
      </div>
    </li>
  );
}
