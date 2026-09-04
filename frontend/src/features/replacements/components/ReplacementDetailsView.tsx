'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  History,
  LoaderCircle,
  MessageSquarePlus,
  RotateCcw,
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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { notesApi } from '@/features/notes/api/notes-api';
import type { NoteRecord } from '@/features/notes/types/note.types';
import { useOrderDetailWithRefresh } from '@/features/orders/hooks/useOrderDetail';
import { getOrderFinancialSummary } from '@/features/orders/lib/order-financials';
import { GrossProfitSummaryCard } from '@/features/shipments/components/GrossProfitSummaryCard';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatOrderPaymentMethod,
  formatOrderStatus,
  formatRelativeTime,
} from '@/features/orders/lib/order-formatters';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/lib/stores/toast.store';
import { useReplacementDetail } from '../hooks/useReplacementDetail';
import { formatReplacementStatus } from '../lib/replacements.helpers';
import { REPLACEMENT_STATUSES, type ReplacementStatus } from '../types/replacement.types';
import { ReplacementStatusBadge } from './ReplacementStatusBadge';

type ReplacementActivityEntry = {
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

export function ReplacementDetailsView({
  replacementId,
}: {
  replacementId: string;
}) {
  const {
    replacement,
    isLoading,
    error,
    isUpdating,
    updateError,
    updateReplacement,
    clearUpdateError,
  } = useReplacementDetail(replacementId);
  const authUser = useAuthStore((state) => state.user);
  const canManage = authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const [customerReason, setCustomerReason] = useState('');
  const [yardUpdate, setYardUpdate] = useState('');
  const [replacementProNumber, setReplacementProNumber] = useState('');
  const [replacementCarrierName, setReplacementCarrierName] = useState('');
  const [replacementStatus, setReplacementStatus] =
    useState<ReplacementStatus>('WAITING_YARD_RESPONSE');
  const [formError, setFormError] = useState<string | null>(null);
  const [orderRefreshKey, setOrderRefreshKey] = useState(0);
  const {
    order,
    isLoading: isOrderLoading,
    error: orderError,
  } = useOrderDetailWithRefresh(replacement?.orderId ?? '', orderRefreshKey);
  const [shipmentNotes, setShipmentNotes] = useState<NoteRecord[]>([]);
  const [isLoadingShipmentNotes, setIsLoadingShipmentNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    if (!replacement) {
      return;
    }

    setCustomerReason(replacement.customerReason);
    setYardUpdate(replacement.yardUpdate ?? '');
    setReplacementProNumber(replacement.replacementProNumber ?? '');
    setReplacementCarrierName(replacement.replacementCarrierName ?? '');
    setReplacementStatus(replacement.replacementStatus);
  }, [replacement]);

  useEffect(() => {
    if (!replacement?.shipmentId) {
      setShipmentNotes([]);
      setIsLoadingShipmentNotes(false);
      return;
    }

    let isMounted = true;

    const loadShipmentNotes = async () => {
      setIsLoadingShipmentNotes(true);
      setNotesError(null);

      try {
        const notes = await notesApi.listByEntity(
          'SHIPMENT',
          replacement.shipmentId!,
        );

        if (isMounted) {
          setShipmentNotes(notes);
        }
      } catch (caughtError) {
        if (isMounted) {
          setNotesError(
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
  }, [replacement?.shipmentId]);

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !replacement) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Replacement details</CardTitle>
          <CardDescription>The requested replacement could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'Replacement details are unavailable.'}
          </div>
          <Link
            href="/replacement-orders"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to replacement orders
          </Link>
        </CardContent>
      </Card>
    );
  }

  const handleUpdate = async () => {
    clearUpdateError();
    setFormError(null);

    if (replacementStatus === 'IN_TRANSIT') {
      if (!replacementCarrierName.trim()) {
        setFormError('Freight carrier is required when replacement status is in transit.');
        return;
      }

      if (!replacementProNumber.trim()) {
        setFormError('PRO number is required when replacement status is in transit.');
        return;
      }
    }

    await updateReplacement({
      customerReason,
      yardUpdate,
      replacementStatus,
      replacementProNumber,
      replacementCarrierName,
    });
    setOrderRefreshKey((currentValue) => currentValue + 1);
    toast.success('Replacement updated', 'Replacement details and history were saved.');
  };

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
        entityId: replacement.orderId,
        message: trimmedMessage,
      });
      setNoteMessage('');
      setIsAddNoteOpen(false);
      setOrderRefreshKey((currentValue) => currentValue + 1);
      toast.success('Note added', 'Replacement activity has been refreshed.');
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

  const financialSummary = order ? getOrderFinancialSummary(order) : null;
  const intake = order?.intakeDetails;
  const gpShipment =
    order?.shipments.find((shipment) => shipment.id === replacement.shipmentId) ??
    order?.shipments[0] ??
    null;
  const gpShipmentCost = gpShipment?.costs[0] ?? null;
  const activityEntries = buildReplacementActivityEntries({
    replacement,
    orderNotes: order?.notes ?? [],
    shipmentNotes,
  });

  return (
    <section className="grid gap-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-3 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/replacement-orders"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 w-fit px-0')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to replacement orders
            </Link>
            <ReplacementStatusBadge status={replacement.replacementStatus} />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Badge variant="info" className="h-6 w-fit text-[0.7rem]">
                <RotateCcw className="h-3.5 w-3.5" />
                Replacement workflow
              </Badge>
              <CardTitle className="truncate text-2xl sm:text-[1.7rem]">
                {replacement.order.orderNumber}
              </CardTitle>
              <CardDescription className="line-clamp-1">
                {replacement.order.customerName} · {replacement.order.partDescription}
              </CardDescription>
            </div>
            <div className="grid gap-1 text-right text-xs text-muted-foreground">
              <span>
                Sale: {replacement.order.salesNumber ?? '—'}
              </span>
              <span>
                Updated {formatRelativeTime(replacement.updatedAt)}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <GrossProfitSummaryCard
        shipmentId={gpShipment?.id}
        totalSaleAmount={
          financialSummary?.gpSaleBasis ?? replacement.order.totalSaleAmount
        }
        originalSaleAmount={order?.totalSaleAmount ?? replacement.order.totalSaleAmount}
        currency={order?.currency ?? replacement.order.currency}
        cost={gpShipmentCost}
        saleMetricLabel={order?.status === 'REFUNDED' ? 'Refund retained' : 'Sale'}
        grossProfitOverride={financialSummary?.grossProfitOverride}
        refundDetails={
          order?.status === 'REFUNDED'
            ? {
                refundType: order.intakeDetails.refundType,
                refundDeductionAmount: order.intakeDetails.refundDeductionAmount,
                refundDeductionReason: order.intakeDetails.refundDeductionReason,
                customerRefundedAmount: financialSummary?.refundedAmount ?? 0,
                refundedAt: order.intakeDetails.refundedAt,
              }
            : null
        }
        additionalCosts={gpShipment?.additionalCosts ?? []}
        costHistories={gpShipment?.costHistories ?? []}
        canAddAdditionalCost={canManage}
        canEditBaseCost={canManage}
        canEditAdditionalCosts={canManage}
        onAdditionalCostAdded={() =>
          setOrderRefreshKey((currentValue) => currentValue + 1)
        }
        onCostUpdated={() =>
          setOrderRefreshKey((currentValue) => currentValue + 1)
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Linked Details</CardTitle>
              <CardDescription>
                Compact order, customer, payment, billing, shipping, and shipment context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {orderError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  Full order details could not load, showing replacement summary.
                </div>
              ) : null}
              {isOrderLoading ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/15 p-4 text-sm text-muted-foreground">
                  Loading full order details...
                </div>
              ) : null}

              <CompactSection title="Order / Payment">
                <Detail label="Order Number" value={replacement.order.orderNumber} />
                <Detail label="Sales Number" value={replacement.order.salesNumber ?? '—'} />
                <Detail
                  label="Order Date"
                  value={intake?.orderDate ? formatDate(intake.orderDate) : 'Not provided'}
                />
                <Detail
                  label="Advisor"
                  value={intake?.advisorName ?? order?.createdBy.name ?? replacement.createdBy.name}
                />
                <Detail
                  label="Status"
                  value={formatOrderStatus(order?.status ?? replacement.order.status)}
                />
                <Detail
                  label="Payment"
                  value={
                    order?.paymentMethod
                      ? formatOrderPaymentMethod(order.paymentMethod)
                      : 'Not required'
                  }
                />
                <Detail
                  label="Sale"
                  value={formatCurrency(
                    replacement.order.totalSaleAmount,
                    replacement.order.currency,
                  )}
                />
                <Detail
                  label="Paid"
                  value={
                    financialSummary
                      ? formatCurrency(
                          financialSummary.retainedPaidAmount,
                          replacement.order.currency,
                        )
                      : 'Not provided'
                  }
                />
                <Detail
                  label="Remaining"
                  value={
                    financialSummary
                      ? formatCurrency(
                          financialSummary.remainingAmount,
                          replacement.order.currency,
                        )
                      : 'Not provided'
                  }
                />
              </CompactSection>

              <CompactSection title="Customer / Part">
                <Detail label="Customer" value={replacement.order.customerName} />
                <Detail label="Phone" value={replacement.order.customerPhone ?? 'Not provided'} />
                <Detail label="Email" value={replacement.order.customerEmail ?? 'Not provided'} wide />
                <Detail label="Part" value={replacement.order.partDescription} wide />
                <Detail label="Make" value={formatNullableText(intake?.vehicleMake)} />
                <Detail label="Model" value={formatNullableText(intake?.vehicleModel)} />
                <Detail label="Year" value={formatNullableText(intake?.vehicleYear)} />
                <Detail label="VIN" value={formatNullableText(intake?.vehicleVin)} />
              </CompactSection>

              <CompactSection title="Billing / Shipping">
                <Detail
                  label="Billing Address"
                  value={formatNullableText(intake?.billingAddress)}
                  wide
                />
                <Detail label="Billing Person" value={formatNullableText(intake?.billingPerson)} />
                <Detail label="Billing Phone" value={formatNullableText(intake?.billingPhone)} />
                <Detail
                  label="Shipping Address"
                  value={
                    <ShippingAddressValue
                      businessName={intake?.companyName}
                      shippingAddress={intake?.shippingAddress}
                    />
                  }
                  wide
                />
                <Detail label="Shipping Person" value={formatNullableText(intake?.shippingPerson)} />
                <Detail label="Shipping Phone" value={formatNullableText(intake?.shippingPhone)} />
              </CompactSection>

              {replacement.shipment ? (
                <CompactSection title="Shipment">
                  <Detail
                    label="BOL / Pickup"
                    value={`${replacement.shipment.bolNumber ?? 'BOL pending'} / ${
                      replacement.shipment.pickupNumber ?? 'Pickup pending'
                    }`}
                  />
                  <Detail
                    label="PRO / Carrier"
                    value={`${replacement.shipment.proNumber ?? 'PRO pending'} / ${
                      replacement.shipment.carrierName ?? 'Carrier pending'
                    }`}
                  />
                  <Detail
                    label="Shipment Status"
                    value={formatReplacementLinkedShipmentStatus(
                      replacement.shipment.status,
                    )}
                  />
                </CompactSection>
              ) : null}

              <CompactSection title="Replacement Transit">
                <Detail
                  label="Freight Carrier"
                  value={replacement.replacementCarrierName ?? 'Carrier pending'}
                />
                <Detail
                  label="PRO Number"
                  value={replacement.replacementProNumber ?? 'PRO pending'}
                />
              </CompactSection>
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">Update Replacement</CardTitle>
                <CardDescription>
                  Save yard progress and move the replacement through the workflow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Replacement Status
                  <Select
                    value={replacementStatus}
                    onChange={(event) =>
                      setReplacementStatus(event.target.value as ReplacementStatus)
                    }
                  >
                    {REPLACEMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatReplacementStatus(status)}
                      </option>
                    ))}
                  </Select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-foreground">
                    Freight Carrier
                    <Input
                      value={replacementCarrierName}
                      onChange={(event) =>
                        setReplacementCarrierName(event.target.value)
                      }
                      placeholder="FedEx Freight"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-foreground">
                    PRO Number
                    <Input
                      value={replacementProNumber}
                      onChange={(event) =>
                        setReplacementProNumber(event.target.value)
                      }
                      placeholder="PRO123456"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Customer Reason
                  <textarea
                    value={customerReason}
                    onChange={(event) => setCustomerReason(event.target.value)}
                    className="min-h-24 rounded-2xl border border-input bg-background px-3.5 py-3 text-sm font-normal text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Yard Update
                  <textarea
                    value={yardUpdate}
                    onChange={(event) => setYardUpdate(event.target.value)}
                    className="min-h-24 rounded-2xl border border-input bg-background px-3.5 py-3 text-sm font-normal text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                  />
                </label>

                {formError || updateError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {formError ?? updateError}
                  </div>
                ) : null}

                <Button disabled={isUpdating} onClick={() => void handleUpdate()}>
                  {isUpdating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Update Replacement
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <History className="h-5 w-5 text-primary" />
                  Notes & Edit History
                </CardTitle>
                <CardDescription className="text-xs">
                  Replacement history, order notes, shipment notes, and edits in one place.
                </CardDescription>
              </div>
              {canManage ? (
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
              ) : null}
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
                  htmlFor="replacement-detail-note"
                  className="text-sm font-semibold text-foreground"
                >
                  New order note
                </label>
                <textarea
                  id="replacement-detail-note"
                  value={noteMessage}
                  rows={3}
                  onChange={(event) => setNoteMessage(event.target.value)}
                  placeholder="Add a replacement update, handoff detail, or internal note."
                  className={cn(
                    'w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

            {isOrderLoading || isLoadingShipmentNotes ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                Loading notes and edit history...
              </div>
            ) : activityEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                No notes or edit history yet.
              </div>
            ) : (
              activityEntries.map((entry) => (
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
                          {formatDateTime(entry.timestamp)} (
                          {formatRelativeTime(entry.timestamp)})
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
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Detail({
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
        'rounded-2xl border border-border/70 bg-secondary/15 p-3',
        wide && 'sm:col-span-2',
      )}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 break-words text-sm font-medium text-foreground">
        {value}
      </div>
    </div>
  );
}

function CompactSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-secondary/10 p-3">
      <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
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
    return <span>Not provided</span>;
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

function buildReplacementActivityEntries({
  replacement,
  orderNotes,
  shipmentNotes,
}: {
  replacement: NonNullable<ReturnType<typeof useReplacementDetail>['replacement']>;
  orderNotes: { id: string; content: string; createdAt: string; author: { name: string } }[];
  shipmentNotes: NoteRecord[];
}): ReplacementActivityEntry[] {
  return [
    ...replacement.histories.map((history) => ({
      id: `replacement-${history.id}`,
      timestamp: history.createdAt,
      authorName: history.createdBy.name,
      label: 'Replacement',
      badgeVariant: 'info' as const,
      body: history.summary,
    })),
    ...orderNotes.filter(isVisibleNote).map((note) => ({
      id: `order-${note.id}`,
      timestamp: note.createdAt,
      authorName: note.author.name,
      label: isOrderEditNote(note.content) ? 'Order edit' : 'Order note',
      badgeVariant: isOrderEditNote(note.content)
        ? ('warning' as const)
        : ('secondary' as const),
      body: formatNoteBody(note.content),
    })),
    ...shipmentNotes.filter((note) => isVisibleNote({ content: note.message })).map((note) => ({
      id: `shipment-${note.id}`,
      timestamp: note.createdAt,
      authorName: note.author.name,
      label: 'Shipment note',
      badgeVariant: 'neutral' as const,
      body: formatNoteBody(note.message),
    })),
  ].sort(
    (firstEntry, secondEntry) =>
      new Date(secondEntry.timestamp).getTime() -
      new Date(firstEntry.timestamp).getTime(),
  );
}

function isVisibleNote(note: { content: string }) {
  return !/^Replacement (request created|updated):/i.test(note.content.trim());
}

function isOrderEditNote(content: string) {
  return /^Order updated:/i.test(content.trim()) || /\bstatus\b.*->/i.test(content);
}

function formatNoteBody(content: string) {
  return content.replace(/^Order updated:\s*/i, '').trim();
}

function formatNullableText(value?: string | null): string {
  return value?.trim() ? value : 'Not provided';
}

function formatReplacementLinkedShipmentStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
