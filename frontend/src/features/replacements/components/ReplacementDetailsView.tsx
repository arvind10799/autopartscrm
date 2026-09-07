'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  History,
  LoaderCircle,
  Plus,
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
  const noteEntries = buildReplacementNoteEntries({
    orderNotes: order?.notes ?? [],
    shipmentNotes,
  });
  const editHistoryEntries = buildReplacementEditHistoryEntries({
    replacement,
    orderNotes: order?.notes ?? [],
    shipmentNotes,
  });
  const statusHistoryEntries = buildReplacementStatusHistoryEntries(replacement);

  return (
    <section className="space-y-5">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <ReplacementSummaryCard replacement={replacement} />

        <div className="space-y-4">
          <GrossProfitSummaryCard
            shipmentId={gpShipment?.id}
            orderId={replacement.orderId}
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

          {canManage ? (
            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CardHeader className="border-b border-border/70 px-4 py-2.5">
                <CardTitle className="text-base">Update Replacement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 p-3">
                <label className="grid gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Replacement Status
                  <Select
                    className="h-8 normal-case tracking-normal"
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

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Freight Carrier
                    <Input
                      className="h-8 normal-case tracking-normal"
                      value={replacementCarrierName}
                      onChange={(event) =>
                        setReplacementCarrierName(event.target.value)
                      }
                      placeholder="FedEx Freight"
                    />
                  </label>
                  <label className="grid gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    PRO Number
                    <Input
                      className="h-8 normal-case tracking-normal"
                      value={replacementProNumber}
                      onChange={(event) =>
                        setReplacementProNumber(event.target.value)
                      }
                      placeholder="PRO123456"
                    />
                  </label>
                </div>

                <label className="grid gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Customer Reason
                  <textarea
                    value={customerReason}
                    rows={2}
                    onChange={(event) => setCustomerReason(event.target.value)}
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                  />
                </label>

                <label className="grid gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Yard Update
                  <textarea
                    value={yardUpdate}
                    rows={2}
                    onChange={(event) => setYardUpdate(event.target.value)}
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                  />
                </label>

                {formError || updateError ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {formError ?? updateError}
                  </div>
                ) : null}

                <Button
                  size="sm"
                  className="h-8 w-full rounded-lg bg-[#ff5a00] text-xs text-white hover:bg-[#e65000]"
                  disabled={isUpdating}
                  onClick={() => void handleUpdate()}
                >
                  {isUpdating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Update replacement
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 px-4 py-3">
            <CardTitle className="text-lg">Linked Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3.5 sm:p-4">
            {orderError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                Full order details could not load, showing replacement summary.
              </div>
            ) : null}
            {isOrderLoading ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-secondary/15 p-3 text-xs text-muted-foreground">
                Loading full order details...
              </div>
            ) : null}

            <DetailSection title="Order / Payment" tone="orange">
              <DetailBlock label="Order Number" value={replacement.order.orderNumber} />
              <DetailBlock label="Sales Number" value={replacement.order.salesNumber ?? 'Not provided'} />
              <DetailBlock
                label="Order Date"
                value={intake?.orderDate ? formatDate(intake.orderDate) : 'Not provided'}
              />
              <DetailBlock
                label="Advisor"
                value={intake?.advisorName ?? order?.createdBy.name ?? replacement.createdBy.name}
              />
              <DetailBlock
                label="Status"
                value={formatOrderStatus(order?.status ?? replacement.order.status)}
              />
              <DetailBlock
                label="Payment"
                value={
                  order?.paymentMethod
                    ? formatOrderPaymentMethod(order.paymentMethod)
                    : 'Not required'
                }
              />
              <DetailBlock
                label="Sale"
                value={formatCurrency(
                  replacement.order.totalSaleAmount,
                  replacement.order.currency,
                )}
              />
              <DetailBlock
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
              <DetailBlock
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
            </DetailSection>

            <DetailSection title="Customer / Part" tone="blue">
              <DetailBlock label="Customer" value={replacement.order.customerName} />
              <DetailBlock label="Phone" value={replacement.order.customerPhone ?? 'Not provided'} />
              <DetailBlock label="Email" value={replacement.order.customerEmail ?? 'Not provided'} />
              <DetailBlock label="Part" value={replacement.order.partDescription} />
              <DetailBlock label="Make" value={formatNullableText(intake?.vehicleMake)} />
              <DetailBlock label="Model" value={formatNullableText(intake?.vehicleModel)} />
              <DetailBlock label="Year" value={formatNullableText(intake?.vehicleYear)} />
              <DetailBlock label="VIN" value={formatNullableText(intake?.vehicleVin)} />
            </DetailSection>

            <DetailSection title="Billing / Shipping" tone="teal">
              <DetailBlock
                label="Billing Address"
                value={formatNullableText(intake?.billingAddress)}
              />
              <DetailBlock label="Billing Person" value={formatNullableText(intake?.billingPerson)} />
              <DetailBlock label="Billing Phone" value={formatNullableText(intake?.billingPhone)} />
              <DetailBlock
                label="Shipping Address"
                value={
                  <ShippingAddressValue
                    businessName={intake?.companyName}
                    shippingAddress={intake?.shippingAddress}
                  />
                }
              />
              <DetailBlock label="Shipping Person" value={formatNullableText(intake?.shippingPerson)} />
              <DetailBlock label="Shipping Phone" value={formatNullableText(intake?.shippingPhone)} />
            </DetailSection>

            {replacement.shipment ? (
              <DetailSection title="Shipment" tone="sky">
                <DetailBlock
                  label="BOL / Pickup"
                  value={`${replacement.shipment.bolNumber ?? 'BOL pending'} / ${
                    replacement.shipment.pickupNumber ?? 'Pickup pending'
                  }`}
                />
                <DetailBlock
                  label="PRO / Carrier"
                  value={`${replacement.shipment.proNumber ?? 'PRO pending'} / ${
                    replacement.shipment.carrierName ?? 'Carrier pending'
                  }`}
                />
                <DetailBlock
                  label="Shipment Status"
                  value={formatReplacementLinkedShipmentStatus(
                    replacement.shipment.status,
                  )}
                />
              </DetailSection>
            ) : null}

            <DetailSection title="Replacement Transit" tone="green">
              <DetailBlock
                label="Freight Carrier"
                value={replacement.replacementCarrierName ?? 'Carrier pending'}
              />
              <DetailBlock
                label="PRO Number"
                value={replacement.replacementProNumber ?? 'PRO pending'}
              />
            </DetailSection>
          </CardContent>
        </Card>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <ReplacementNotesHistoryCard
            noteEntries={noteEntries}
            editHistoryEntries={editHistoryEntries}
            statusHistoryEntries={statusHistoryEntries}
            isLoading={isOrderLoading || isLoadingShipmentNotes}
            error={notesError}
            canManage={canManage}
            isAddNoteOpen={isAddNoteOpen}
            noteMessage={noteMessage}
            noteError={noteError}
            isSavingNote={isSavingNote}
            onToggleAddNote={() => {
              setIsAddNoteOpen((currentValue) => !currentValue);
              setNoteError(null);
            }}
            onNoteMessageChange={setNoteMessage}
            onCancelNote={() => {
              setIsAddNoteOpen(false);
              setNoteError(null);
            }}
            onAddNoteSubmit={handleAddNoteSubmit}
          />
        </aside>
      </div>
    </section>
  );
}

function ReplacementSummaryCard({
  replacement,
}: {
  replacement: NonNullable<ReturnType<typeof useReplacementDetail>['replacement']>;
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Replacement Summary</CardTitle>
          <ReplacementStatusBadge status={replacement.replacementStatus} />
        </div>
      </CardHeader>
      <CardContent className="p-3.5 sm:p-4">
        <DetailSection title="Replacement Summary" tone="orange">
          <DetailBlock
            label="Status"
            value={formatReplacementStatus(replacement.replacementStatus)}
          />
          <DetailBlock
            label="Customer Reason"
            value={formatNullableText(replacement.customerReason)}
          />
          <DetailBlock
            label="Yard Update"
            value={formatNullableText(replacement.yardUpdate)}
          />
          <DetailBlock
            label="Created By"
            value={replacement.createdBy.name}
          />
        </DetailSection>
      </CardContent>
    </Card>
  );
}

function ReplacementNotesHistoryCard({
  noteEntries,
  editHistoryEntries,
  statusHistoryEntries,
  isLoading,
  error,
  canManage,
  isAddNoteOpen,
  noteMessage,
  noteError,
  isSavingNote,
  onToggleAddNote,
  onNoteMessageChange,
  onCancelNote,
  onAddNoteSubmit,
}: {
  noteEntries: ReplacementActivityEntry[];
  editHistoryEntries: ReplacementActivityEntry[];
  statusHistoryEntries: ReplacementActivityEntry[];
  isLoading: boolean;
  error: string | null;
  canManage: boolean;
  isAddNoteOpen: boolean;
  noteMessage: string;
  noteError: string | null;
  isSavingNote: boolean;
  onToggleAddNote: () => void;
  onNoteMessageChange: (value: string) => void;
  onCancelNote: () => void;
  onAddNoteSubmit: () => Promise<void>;
}) {
  return (
    <Card className="flex overflow-hidden border-border/70 shadow-sm lg:max-h-[calc(100vh-3rem)] lg:flex-col">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-4 w-4 text-primary" />
            NOTES
          </CardTitle>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg bg-[#ff5a00] px-3 text-xs text-white hover:bg-[#e65000]"
              onClick={onToggleAddNote}
            >
              <Plus className="h-4 w-4" />
              Add note
            </Button>
          ) : null}
        </div>
      </CardHeader>

      {isAddNoteOpen ? (
        <div className="border-b border-border/70 bg-card p-3.5 sm:p-4">
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void onAddNoteSubmit();
            }}
          >
            <label
              htmlFor="replacement-detail-note"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Add note
            </label>
            <textarea
              id="replacement-detail-note"
              value={noteMessage}
              rows={3}
              onChange={(event) => onNoteMessageChange(event.target.value)}
              placeholder="Add note"
              className={cn(
                'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                noteError ? 'border-destructive/60' : null,
              )}
            />
            {noteError ? <p className="text-sm text-destructive">{noteError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-lg px-3 text-xs"
                disabled={isSavingNote}
                onClick={onCancelNote}
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

      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5 sm:p-4">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-dashed border-border/80 p-3 text-xs text-muted-foreground">
            Loading notes and edit history...
          </div>
        ) : (
          <>
            <ReplacementActivityTimeline
              entries={noteEntries}
              emptyMessage="No internal notes yet."
            />
            <ReplacementTimelineGroup
              title="Edit History Timeline"
              entries={editHistoryEntries}
              emptyMessage="No edit history has been recorded yet."
            />
            <ReplacementTimelineGroup
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

function DetailSection({
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
      <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">{children}</div>
    </section>
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
      <p className="font-bold uppercase text-foreground/85">{label}</p>
      <div className="min-w-0 whitespace-pre-wrap font-medium text-foreground">
        {value}
      </div>
    </div>
  );
}

type DetailTone = 'orange' | 'blue' | 'teal' | 'sky' | 'green' | 'slate';

function getDetailToneClassName(tone: DetailTone) {
  const classes: Record<DetailTone, string> = {
    orange:
      'border-orange-200 bg-orange-50/70 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-200',
    blue:
      'border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200',
    teal:
      'border-teal-200 bg-teal-50/70 text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/20 dark:text-teal-200',
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

function buildReplacementNoteEntries({
  orderNotes,
  shipmentNotes,
}: {
  orderNotes: { id: string; content: string; createdAt: string; author: { name: string } }[];
  shipmentNotes: NoteRecord[];
}): ReplacementActivityEntry[] {
  return [
    ...orderNotes.filter(isPlainReplacementNote).map((note) => ({
      id: `order-${note.id}`,
      timestamp: note.createdAt,
      authorName: note.author.name,
      label: 'Note',
      badgeVariant: 'secondary' as const,
      body: formatNoteBody(note.content),
    })),
    ...shipmentNotes.filter((note) => isPlainReplacementNote({ content: note.message })).map((note) => ({
      id: `shipment-${note.id}`,
      timestamp: note.createdAt,
      authorName: note.author.name,
      label: 'Note',
      badgeVariant: 'neutral' as const,
      body: formatNoteBody(note.message),
    })),
  ].sort(compareReplacementEntriesDesc);
}

function buildReplacementEditHistoryEntries({
  replacement,
  orderNotes,
  shipmentNotes,
}: {
  replacement: NonNullable<ReturnType<typeof useReplacementDetail>['replacement']>;
  orderNotes: { id: string; content: string; createdAt: string; author: { name: string } }[];
  shipmentNotes: NoteRecord[];
}): ReplacementActivityEntry[] {
  return [
    ...replacement.histories
      .filter((history) => !history.previousStatus || history.previousStatus === history.nextStatus)
      .map((history) => ({
        id: `replacement-edit-${history.id}`,
        timestamp: history.createdAt,
        authorName: history.createdBy.name,
        label: 'Replacement updated',
        badgeVariant: 'info' as const,
        body: history.summary,
      })),
    ...orderNotes.filter(isEditHistoryNote).map((note) => ({
      id: `order-edit-${note.id}`,
      timestamp: note.createdAt,
      authorName: note.author.name,
      label: getInvoiceActivityLabel(note.content) ?? 'Order updated',
      badgeVariant: 'info' as const,
      body: formatNoteBody(note.content),
    })),
    ...shipmentNotes.filter((note) => isEditHistoryNote({ content: note.message })).map((note) => ({
      id: `shipment-edit-${note.id}`,
      timestamp: note.createdAt,
      authorName: note.author.name,
      label: 'Shipment updated',
      badgeVariant: 'neutral' as const,
      body: formatNoteBody(note.message),
    })),
  ].sort(compareReplacementEntriesDesc);
}

function buildReplacementStatusHistoryEntries(
  replacement: NonNullable<ReturnType<typeof useReplacementDetail>['replacement']>,
): ReplacementActivityEntry[] {
  return [
    ...replacement.histories
      .filter((history) => history.previousStatus && history.previousStatus !== history.nextStatus)
      .map((history) => ({
        id: `replacement-status-${history.id}`,
        timestamp: history.createdAt,
        authorName: history.createdBy.name,
        label: 'Status changed',
        badgeVariant: 'warning' as const,
        body: (
          <span>
            {history.previousStatus
              ? formatReplacementStatus(history.previousStatus)
              : 'Created'}{' '}
            → {history.nextStatus ? formatReplacementStatus(history.nextStatus) : 'Not provided'}
            {history.summary ? (
              <>
                <br />
                {history.summary}
              </>
            ) : null}
          </span>
        ),
      })),
    {
      id: `${replacement.id}-created`,
      timestamp: replacement.createdAt,
      authorName: replacement.createdBy.name,
      label: 'Replacement created',
      badgeVariant: 'success' as const,
      body: `Initial status: ${formatReplacementStatus(replacement.replacementStatus)}`,
    },
  ].sort(compareReplacementEntriesDesc);
}

function compareReplacementEntriesDesc(
  firstEntry: ReplacementActivityEntry,
  secondEntry: ReplacementActivityEntry,
) {
  return (
    new Date(secondEntry.timestamp).getTime() -
    new Date(firstEntry.timestamp).getTime()
  );
}

function isPlainReplacementNote(note: { content: string }) {
  const trimmedContent = note.content.trim();

  return (
    !isEditHistoryNote(note) &&
    !/^Replacement (request created|updated):/i.test(trimmedContent)
  );
}

function isEditHistoryNote(note: { content: string }) {
  const trimmedContent = note.content.trim();

  return (
    /^Order updated:/i.test(trimmedContent) ||
    /^Shipment updated:/i.test(trimmedContent) ||
    /^Invoice (generated|signature request sent|signature request resent|updated):/i.test(trimmedContent) ||
    /^Signed invoice cloned and signature request sent:/i.test(trimmedContent)
  );
}

function getInvoiceActivityLabel(content: string) {
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

function formatNoteBody(content: string) {
  return content
    .replace(/^Order updated:\s*/i, '')
    .replace(/^Shipment updated:\s*/i, '')
    .replace(/^Invoice generated:\s*/i, '')
    .replace(/^Invoice signature request sent:\s*/i, '')
    .replace(/^Invoice signature request resent:\s*/i, '')
    .replace(/^Invoice updated:\s*/i, '')
    .replace(/^Signed invoice cloned and signature request sent:\s*/i, '')
    .trim();
}

function ReplacementTimelineGroup({
  title,
  entries,
  emptyMessage,
}: {
  title: string;
  entries: ReplacementActivityEntry[];
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
        <ReplacementActivityTimeline
          entries={entries}
          emptyMessage={emptyMessage}
          showBadges
        />
      </div>
    </details>
  );
}

function ReplacementActivityTimeline({
  entries,
  emptyMessage,
  showBadges = false,
}: {
  entries: ReplacementActivityEntry[];
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
        <ReplacementActivityItem
          key={entry.id}
          entry={entry}
          showBadge={showBadges}
        />
      ))}
    </ol>
  );
}

function ReplacementActivityItem({
  entry,
  showBadge,
}: {
  entry: ReplacementActivityEntry;
  showBadge: boolean;
}) {
  const isPlainNote = entry.label === 'Note';

  return (
    <li className="relative pl-6">
      <span
        className={cn(
          'absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background',
          getReplacementTimelineDotClassName(entry.badgeVariant),
        )}
      />
      <div className="space-y-1">
        <p className="text-xs leading-5 text-muted-foreground">
          <span
            className={cn(
              'font-semibold',
              isPlainNote
                ? 'text-[#d94d00] dark:text-orange-300'
                : 'text-foreground',
            )}
          >
            {entry.authorName}
          </span>{' '}
          | {formatDateTime(entry.timestamp)} ({formatRelativeTime(entry.timestamp)})
        </p>
        {showBadge || !isPlainNote ? (
          <Badge
            variant={entry.badgeVariant}
            className="h-5 rounded-md px-2 text-[10px]"
          >
            {entry.label}
          </Badge>
        ) : null}
        <div
          className={cn(
            'whitespace-pre-wrap text-xs leading-5',
            isPlainNote ? 'font-medium text-foreground' : 'text-foreground/85',
          )}
        >
          {entry.body}
        </div>
      </div>
    </li>
  );
}

function getReplacementTimelineDotClassName(
  variant?: ReplacementActivityEntry['badgeVariant'],
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
