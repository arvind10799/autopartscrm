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
import { useAuthStore } from '@/features/auth/store/auth.store';
import { InvoiceActions } from '@/features/invoices/components/InvoiceActions';
import { GrossProfitSummaryCard } from '@/features/shipments/components/GrossProfitSummaryCard';
import { ShipmentStatusBadge } from '@/features/shipments/components/ShipmentStatusBadge';
import { formatShipmentStatus } from '@/features/shipments/lib/shipment-formatters';
import { toast } from '@/lib/stores/toast.store';
import { cn } from '@/lib/utils/cn';
import { useOrderDetailWithRefresh } from '../hooks/useOrderDetail';
import { getOrderFinancialSummary } from '../lib/order-financials';
import {
  OrderResolutionDetails,
} from './OrderResolutionActions';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatOrderPaymentMethod,
  formatOrderStatus,
  formatRelativeTime,
} from '../lib/order-formatters';
import type {
  OrderDetail,
  OrderNote,
  OrderShipment,
  OrderShipmentStatus,
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
  const authUser = useAuthStore((state) => state.user);
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
  const financialSummary = getOrderFinancialSummary(order);
  const notesTimeline = buildNoteTimeline(order.notes);
  const editHistoryTimeline = buildEditHistoryTimeline(order.notes);
  const statusTimeline = buildStatusTimeline(order);
  const shipmentTimeline = buildShipmentTimeline(order.shipments);
  const latestShipment = order.shipments[0] ?? null;
  const latestShipmentCost = order.shipments[0]?.costs?.[0] ?? null;
  const canAddAdditionalCost =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const canEditGpCosts =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';

  return (
    <section className="space-y-6">
      <InvoiceActions
        order={order}
        onInvoiceCreated={() => setRefreshKey((currentValue) => currentValue + 1)}
      />

      <GrossProfitSummaryCard
        shipmentId={latestShipment?.id}
        totalSaleAmount={financialSummary.gpSaleBasis}
        currency={order.currency}
        cost={latestShipmentCost}
        saleMetricLabel={order.status === 'REFUNDED' ? 'Refund retained' : 'Sale'}
        grossProfitOverride={financialSummary.grossProfitOverride}
        refundDetails={
          order.status === 'REFUNDED'
            ? {
                refundType: order.intakeDetails.refundType,
                refundDeductionAmount: order.intakeDetails.refundDeductionAmount,
                refundDeductionReason: order.intakeDetails.refundDeductionReason,
                customerRefundedAmount: financialSummary.refundedAmount,
                refundedAt: order.intakeDetails.refundedAt,
              }
            : null
        }
        additionalCosts={latestShipment?.additionalCosts ?? []}
        costHistories={latestShipment?.costHistories ?? []}
        canAddAdditionalCost={canAddAdditionalCost}
        canEditBaseCost={canEditGpCosts}
        canEditAdditionalCosts={canEditGpCosts}
        onAdditionalCostAdded={() =>
          setRefreshKey((currentValue) => currentValue + 1)
        }
        onCostUpdated={() => setRefreshKey((currentValue) => currentValue + 1)}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,0.92fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl sm:text-2xl">Order details</CardTitle>
              <CardDescription>
                Compact order, customer, vehicle, pricing, billing, and shipping details.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
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
                  label="Part Description"
                  value={intake.vehicleNotes ?? 'Not provided'}
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
                  value={
                    <ShippingAddressValue
                      businessName={intake.companyName}
                      shippingAddress={intake.shippingAddress}
                    />
                  }
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

              <DetailSection title="Pricing / Sales Info">
                <DetailBlock
                  label="Miles Offered"
                  value={formatNullableText(intake.milesOffered)}
                />
                <DetailBlock
                  label="Price Offered"
                  value={formatCurrency(order.salePrice, order.currency)}
                />
                <DetailBlock
                  label="Base Price"
                  value={formatNullableCurrency(intake.basePrice, order.currency)}
                />
                <DetailBlock
                  label="Sales Tax"
                  value={formatNullableCurrency(intake.salesTax, order.currency)}
                />
                <DetailBlock
                  label="Shipping Charges"
                  value={formatNullableCurrency(intake.shippingCharges, order.currency)}
                />
                <DetailBlock
                  label="Profit"
                  value={formatNullableCurrency(intake.profit, order.currency)}
                />
                <DetailBlock
                  label="Total"
                  value={formatCurrency(order.totalSaleAmount, order.currency)}
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
              </DetailSection>

              <OrderResolutionDetails order={order} />
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="lg:max-h-[calc(100vh-3rem)] lg:overflow-hidden">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <History className="h-5 w-5 text-primary" />
                    Notes & Edit History
                  </CardTitle>
                  <CardDescription className="text-xs">
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

            <CardContent className="space-y-4 lg:max-h-[calc(100vh-10.5rem)] lg:overflow-y-auto">
              {isAddNoteOpen ? (
                <form
                  className="space-y-2.5 rounded-2xl border border-border/70 bg-secondary/20 p-3"
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
                    rows={3}
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
      action: 'Note',
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

function formatNullableCurrency(value: number | null, currency = 'USD'): string {
  return value === null ? 'Not provided' : formatCurrency(value, currency);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'Not provided' : String(value);
}

function formatNullableText(value: string | null): string {
  return value?.trim() ? value : 'Not provided';
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

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">{children}</div>
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
    <details className="group rounded-2xl border border-border/70 bg-background/70 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-base font-semibold text-foreground marker:hidden">
        {title}
        <ChevronDown className="h-5 w-5 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-2.5 px-3.5 pb-3.5 sm:grid-cols-2 2xl:grid-cols-3">
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
    <div className="rounded-xl border border-border/70 bg-secondary/20 p-2.5">
      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground">
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
        <p className="whitespace-pre-wrap text-foreground">{trimmedShippingAddress}</p>
      ) : null}
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
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h3>
        <Badge variant="outline" className="h-5 px-2 text-[11px]">
          {entries.length}
        </Badge>
      </div>

      {entries.length > 0 ? (
        <ol className="space-y-2">
          {entries.map((entry) => (
            <TimelineItem key={entry.id} entry={entry} />
          ))}
        </ol>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="relative rounded-xl border border-border/70 bg-background/85 px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {entry.actorName}
            <span className="mx-1.5 text-muted-foreground">|</span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {formatDateTime(entry.timestamp)} ({formatRelativeTime(entry.timestamp)})
            </span>
          </p>
        </div>
        <Badge
          variant={entry.badgeVariant ?? 'secondary'}
          className="h-5 shrink-0 rounded-full px-2 text-[11px]"
        >
          {entry.action}
        </Badge>
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
        {entry.body}
      </div>
    </li>
  );
}
