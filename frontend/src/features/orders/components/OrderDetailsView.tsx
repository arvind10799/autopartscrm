'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  History,
  LoaderCircle,
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
import { ReplacementTracker } from '@/features/replacements/components/ReplacementTracker';
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
  const notesTimeline = buildNoteTimeline(order);
  const editHistoryTimeline = buildEditHistoryTimeline(order.notes);
  const statusTimeline = buildStatusTimeline(order);
  const shipmentTimeline = buildShipmentTimeline(order.shipments);
  const remarksTimeline = [
    ...notesTimeline,
    ...shipmentTimeline,
  ].sort(compareTimelineEntriesDesc);
  const latestShipment = order.shipments[0] ?? null;
  const latestShipmentCost = order.shipments[0]?.costs?.[0] ?? null;
  const canAddAdditionalCost =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const canEditGpCosts =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';

  return (
    <section className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
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
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,0.92fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-xl">Order details</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 p-3.5 sm:p-4">
              <DetailSection title="Basic Order Info" tone="orange">
                <DetailBlock label="Order number" value={order.orderNumber} />
                <DetailBlock
                  label="Sales Number"
                  value={order.salesNumber ?? 'Not provided'}
                />
                <DetailBlock
                  label="Advisor name"
                  value={intake.advisorName ?? order.createdBy.name}
                />
                <DetailBlock
                  label="Date"
                  value={intake.orderDate ? formatDate(intake.orderDate) : 'Not provided'}
                />
              </DetailSection>

              <DetailSection title="Customer Info" tone="blue">
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

              <DetailSection title="Vehicle / Part Info" tone="teal">
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
              </DetailSection>

              <CollapsibleDetailSection title="Billing Information" tone="amber">
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

              <CollapsibleDetailSection title="Shipping Information" tone="sky">
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
                {latestShipment ? (
                  <>
                    <DetailBlock
                      label="PRO Number"
                      value={latestShipment.proNumber ?? 'PRO pending'}
                    />
                    <DetailBlock
                      label="Freight Carrier"
                      value={latestShipment.carrierName ?? 'Carrier pending'}
                    />
                  </>
                ) : null}
              </CollapsibleDetailSection>

              <DetailSection title="Pricing / Sales Info" tone="green">
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

              {canAddAdditionalCost ? (
                <ReplacementTracker orderId={order.id} compact />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="lg:max-h-[calc(100vh-3rem)] lg:overflow-hidden">
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <History className="h-5 w-5 text-primary" />
                Remarks
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 p-3.5 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto sm:p-4">
              <RemarkTimeline
                entries={remarksTimeline}
                emptyMessage="No internal notes yet."
              />

              <form
                className="space-y-2 border-t border-border/70 pt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAddNoteSubmit();
                }}
              >
                <label
                  htmlFor="order-detail-note"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Add Remark
                </label>
                <textarea
                  id="order-detail-note"
                  value={noteMessage}
                  rows={3}
                  onChange={(event) => setNoteMessage(event.target.value)}
                  placeholder="Add Remark"
                  className={cn(
                    'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    noteError ? 'border-destructive/60' : null,
                  )}
                />
                {noteError ? (
                  <p className="text-sm text-destructive">{noteError}</p>
                ) : null}
                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-[#ff5a00] text-white hover:bg-[#e65000]"
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
              </form>

              <TimelineGroup
                title="Edit History Timeline"
                entries={editHistoryTimeline}
                emptyMessage="No edit history has been recorded yet."
                collapsible
              />
              <TimelineGroup
                title="Status Change History"
                entries={statusTimeline}
                emptyMessage="No status changes have been recorded yet."
                collapsible
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function buildNoteTimeline(order: OrderDetail): TimelineEntry[] {
  return order.notes
    .filter((note) => !isHistoryNote(note) && !isStatusHistoryNote(note))
    .map((note) => ({
      id: note.id,
      timestamp: note.createdAt,
      actorName: note.author.name,
      action: 'Note',
      body: formatOrderNoteBody(note.content, order),
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
  tone = 'slate',
  children,
}: {
  title: string;
  tone?: DetailTone;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border p-3 shadow-sm', getDetailToneClassName(tone))}>
      <h3 className="text-xs font-bold uppercase tracking-[0.16em]">
        {title}
      </h3>
      <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">{children}</div>
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
  children: React.ReactNode;
}) {
  return (
    <details className={cn('group rounded-xl border p-3 shadow-sm', getDetailToneClassName(tone))}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em] marker:hidden">
        {title}
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
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
    <div className="grid min-w-0 grid-cols-[7.25rem_minmax(0,1fr)] gap-2 text-xs leading-5">
      <p className="font-bold uppercase text-foreground/85">
        {label}
      </p>
      <div className="min-w-0 whitespace-pre-wrap font-medium text-foreground">
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

function TimelineGroup({
  title,
  entries,
  emptyMessage,
  collapsible = false,
}: {
  title: string;
  entries: TimelineEntry[];
  emptyMessage: string;
  collapsible?: boolean;
}) {
  const content = (
    <>
      {entries.length > 0 ? (
        <ol className="space-y-2 pt-2">
          {entries.map((entry) => (
            <TimelineItem key={entry.id} entry={entry} />
          ))}
        </ol>
      ) : (
        <div className="mt-2 rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </>
  );

  if (collapsible) {
    return (
      <details className="group rounded-xl border border-border/70 bg-secondary/10 px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
          <span>
            <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {title}
            </span>
            <span className="text-xs text-muted-foreground">
              {entries.length} record{entries.length === 1 ? '' : 's'}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        {content}
      </details>
    );
  }

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

      {content}
    </section>
  );
}

function RemarkTimeline({
  entries,
  emptyMessage,
}: {
  entries: TimelineEntry[];
  emptyMessage: string;
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
        <RemarkItem key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}

function RemarkItem({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="relative pl-6">
      <span
        className={cn(
          'absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background',
          getTimelineDotClassName(entry.badgeVariant),
        )}
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{entry.actorName}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(entry.timestamp)} ({formatRelativeTime(entry.timestamp)})
        </p>
        <Badge
          variant={entry.badgeVariant ?? 'secondary'}
          className="h-5 rounded-md px-2 text-[10px]"
        >
          {entry.action}
        </Badge>
        <div className="whitespace-pre-wrap text-xs leading-5 text-foreground/85">
          {entry.body}
        </div>
      </div>
    </li>
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
