'use client';

import { ChevronDown, Edit3, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { costsApi } from '@/features/costs/api/costs-api';
import { formatCurrency, formatDateTime } from '@/features/orders/lib/order-formatters';
import { toast } from '@/lib/stores/toast.store';
import { getErrorMessage } from '@/lib/utils/error';

type ShipmentCostLike = {
  purchaseAmount: number;
  shippingAmount: number;
  additionalAmount: number;
  grossProfit: number;
  currency: string;
  notes: string | null;
} | null;

type ShipmentAdditionalCostLike = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: {
    name: string;
  };
};

type ShipmentCostHistoryLike = {
  id: string;
  action: string;
  summary: string;
  changes?: unknown;
  createdAt: string;
  createdBy: {
    name: string;
  };
};

type RefundDetailsLike = {
  refundType: 'FULL' | 'PARTIAL' | null;
  refundDeductionAmount: number | null;
  refundDeductionReason: string | null;
  customerRefundedAmount?: number | null;
  refundedAt: string | null;
};

export function GrossProfitSummaryCard({
  shipmentId,
  totalSaleAmount,
  currency,
  cost,
  saleMetricLabel = 'Sale',
  grossProfitOverride,
  refundDetails,
  additionalCosts = [],
  costHistories = [],
  canAddAdditionalCost = false,
  canEditBaseCost = false,
  canEditAdditionalCosts = false,
  onAdditionalCostAdded,
  onCostUpdated,
}: {
  shipmentId?: string;
  totalSaleAmount: number;
  currency: string;
  cost: ShipmentCostLike;
  saleMetricLabel?: string;
  grossProfitOverride?: number;
  refundDetails?: RefundDetailsLike | null;
  additionalCosts?: ShipmentAdditionalCostLike[];
  costHistories?: ShipmentCostHistoryLike[];
  canAddAdditionalCost?: boolean;
  canEditBaseCost?: boolean;
  canEditAdditionalCosts?: boolean;
  onAdditionalCostAdded?: () => void | Promise<void>;
  onCostUpdated?: () => void | Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditingBaseCost, setIsEditingBaseCost] = useState(false);
  const [editingAdditionalCost, setEditingAdditionalCost] =
    useState<ShipmentAdditionalCostLike | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [purchaseAmountInput, setPurchaseAmountInput] = useState('');
  const [shippingAmountInput, setShippingAmountInput] = useState('');
  const [currencyInput, setCurrencyInput] = useState('');
  const [baseCostEditNote, setBaseCostEditNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const purchaseAmount = cost?.purchaseAmount ?? 0;
  const shippingAmount = cost?.shippingAmount ?? 0;
  const displayCurrency = cost?.currency ?? currency;
  const additionalAmount = useMemo(
    () =>
      additionalCosts.length > 0
        ? additionalCosts.reduce((total, entry) => total + entry.amount, 0)
        : cost?.additionalAmount ?? 0,
    [additionalCosts, cost?.additionalAmount],
  );
  const totalCosts = purchaseAmount + shippingAmount + additionalAmount;
  const grossProfit = grossProfitOverride ?? totalSaleAmount - totalCosts;
  const grossProfitTone =
    grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive';
  const canOpenForm = canAddAdditionalCost && Boolean(shipmentId) && Boolean(cost);
  const canOpenBaseEditForm =
    canEditBaseCost && Boolean(shipmentId) && Boolean(cost);
  const hasRefundDetails = Boolean(refundDetails?.refundType);

  const resetAdditionalCostForm = () => {
    setAmount('');
    setReason('');
    setFormError(null);
  };

  const closeAdditionalCostForm = () => {
    setIsAdding(false);
    setEditingAdditionalCost(null);
    resetAdditionalCostForm();
  };

  const openBaseEditForm = () => {
    setPurchaseAmountInput(purchaseAmount.toFixed(2));
    setShippingAmountInput(shippingAmount.toFixed(2));
    setCurrencyInput(displayCurrency);
    setBaseCostEditNote('');
    setFormError(null);
    setIsEditingBaseCost(true);
  };

  const openAdditionalCostEditForm = (entry: ShipmentAdditionalCostLike) => {
    setAmount(entry.amount.toFixed(2));
    setReason(entry.reason);
    setFormError(null);
    setEditingAdditionalCost(entry);
    setIsAdding(false);
  };

  const handleAdditionalCostSubmit = async () => {
    const parsedAmount = Number(amount);
    const trimmedReason = reason.trim();
    const isEditingAdditionalCost = Boolean(editingAdditionalCost);

    if (
      !shipmentId ||
      (!isEditingAdditionalCost && !canOpenForm) ||
      (isEditingAdditionalCost && !canEditAdditionalCosts)
    ) {
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter an additional cost greater than 0.');
      return;
    }

    if (!trimmedReason) {
      setFormError('Reason is required.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingAdditionalCost) {
        await costsApi.updateAdditionalCost(
          shipmentId,
          editingAdditionalCost.id,
          {
            amount: parsedAmount,
            reason: trimmedReason,
          },
        );
        toast.success(
          'Additional cost updated',
          'GP calculation has been refreshed.',
        );
      } else {
        await costsApi.createAdditionalCost(shipmentId, {
          amount: parsedAmount,
          reason: trimmedReason,
        });
        toast.success(
          'Additional cost added',
          'GP calculation has been updated.',
        );
      }
      closeAdditionalCostForm();
      if (onCostUpdated) {
        await onCostUpdated();
      } else {
        await onAdditionalCostAdded?.();
      }
    } catch (error) {
      setFormError(
        getErrorMessage(error, 'Unable to save additional cost right now.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBaseCostSubmit = async () => {
    const parsedPurchaseAmount = Number(purchaseAmountInput);
    const parsedShippingAmount = Number(shippingAmountInput);
    const normalizedCurrency = currencyInput.trim().toUpperCase();
    const trimmedEditNote = baseCostEditNote.trim();

    if (!shipmentId || !cost || !canOpenBaseEditForm) {
      return;
    }

    if (!Number.isFinite(parsedPurchaseAmount) || parsedPurchaseAmount < 0) {
      setFormError('Enter a valid part cost.');
      return;
    }

    if (!Number.isFinite(parsedShippingAmount) || parsedShippingAmount < 0) {
      setFormError('Enter a valid actual shipping cost.');
      return;
    }

    if (!/^[A-Z]{3,10}$/.test(normalizedCurrency)) {
      setFormError('Enter a valid currency code.');
      return;
    }

    if (!trimmedEditNote) {
      setFormError('Add a note explaining why these costs changed.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      await costsApi.updateByShipmentId(shipmentId, {
        purchaseAmount: parsedPurchaseAmount,
        shippingCharges: parsedShippingAmount,
        additionalCharges: additionalAmount,
        currency: normalizedCurrency,
        notes: trimmedEditNote,
      });
      toast.success('Shipment cost updated', 'GP calculation has been refreshed.');
      setIsEditingBaseCost(false);
      await onCostUpdated?.();
    } catch (error) {
      setFormError(
        getErrorMessage(error, 'Unable to update shipment cost right now.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className={isExpanded ? 'space-y-3 pb-3' : 'pb-4'}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardDescription>GP calculation</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">
              <span className={grossProfitTone}>
                {formatCurrency(grossProfit, displayCurrency)}
              </span>
            </CardTitle>
            {hasRefundDetails ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                Refunded
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((currentValue) => !currentValue)}
          >
            {isExpanded ? 'Hide details' : 'View details'}
            <ChevronDown
              className={`h-4 w-4 transition ${isExpanded ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>
      </CardHeader>

      {isExpanded ? (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {canOpenBaseEditForm ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openBaseEditForm}
              >
                <Edit3 className="h-4 w-4" />
                Edit GP Costs
              </Button>
            ) : null}
            {canAddAdditionalCost ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canOpenForm}
                onClick={() => {
                  setIsAdding(true);
                  setEditingAdditionalCost(null);
                  resetAdditionalCostForm();
                }}
              >
                <Plus className="h-4 w-4" />
                Add Additional Cost
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-5">
            <GpMetric
              label={saleMetricLabel}
              value={formatCurrency(totalSaleAmount, displayCurrency)}
            />
            <GpMetric
              label="Part cost"
              value={formatCurrency(purchaseAmount, displayCurrency)}
            />
            <GpMetric
              label="Shipping cost"
              value={formatCurrency(shippingAmount, displayCurrency)}
            />
            <GpMetric
              label="Additional"
              value={formatCurrency(additionalAmount, displayCurrency)}
            />
            <GpMetric
              label="Total costs"
              value={formatCurrency(totalCosts, displayCurrency)}
            />
          </div>

          <p className="rounded-xl border border-dashed border-border/70 bg-secondary/15 px-3 py-2 text-xs text-muted-foreground">
            Formula:{' '}
            {refundDetails?.refundType === 'PARTIAL'
              ? 'deduction amount - part cost - actual shipping cost - additional costs.'
              : refundDetails?.refundType === 'FULL'
                ? 'retained amount - part cost - actual shipping cost - additional costs.'
                : 'sale - part cost - actual shipping cost - additional costs.'}
          </p>

          {hasRefundDetails ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2 text-sm text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-100">
              <p className="font-semibold">
                Refund details:{' '}
                {refundDetails?.refundType === 'PARTIAL'
                  ? 'Partial refund'
                  : 'Full refund'}
              </p>
              {refundDetails?.refundType === 'PARTIAL' ? (
                <div className="mt-1 space-y-1 text-xs">
                  <p>
                    Customer refunded amount:{' '}
                    {formatCurrency(
                      refundDetails.customerRefundedAmount ?? 0,
                      displayCurrency,
                    )}
                  </p>
                  <p>
                    Deduction Amount:{' '}
                    {formatCurrency(
                      refundDetails.refundDeductionAmount ?? 0,
                      displayCurrency,
                    )}
                  </p>
                  <p className="whitespace-pre-wrap">
                    Reason for Deduction:{' '}
                    {refundDetails.refundDeductionReason ?? 'Not provided'}
                  </p>
                </div>
              ) : (
                null
              )}
              {refundDetails?.refundedAt ? (
                <p className="mt-1 text-[11px] text-violet-800 dark:text-violet-200">
                  Refunded {formatDateTime(refundDetails.refundedAt)}
                </p>
              ) : null}
            </div>
          ) : null}

          {additionalCosts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Additional cost history
              </p>
              <div className="grid gap-2">
                {additionalCosts.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid gap-2 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2 text-sm sm:grid-cols-[8rem_1fr_auto_auto]"
                  >
                    <span className="font-semibold text-foreground">
                      {formatCurrency(entry.amount, displayCurrency)}
                    </span>
                    <span className="text-muted-foreground">{entry.reason}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.createdBy.name} · {formatDateTime(entry.createdAt)}
                    </span>
                    {canEditAdditionalCosts ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openAdditionalCostEditForm(entry)}
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <details className="group rounded-xl border border-border/70 bg-secondary/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 marker:hidden">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  GP Edit History
                </p>
                <p className="text-xs text-muted-foreground">
                  {costHistories.length} recorded change
                  {costHistories.length === 1 ? '' : 's'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/70 px-3 py-2">
              {costHistories.length > 0 ? (
                <div className="space-y-2">
                  {costHistories.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">
                          {entry.summary}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        By {entry.createdBy.name}
                      </p>
                      <HistoryChangeList changes={entry.changes} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border/70 bg-background/50 px-3 py-2 text-sm text-muted-foreground">
                  No GP cost changes have been recorded yet.
                </p>
              )}
            </div>
          </details>
        </CardContent>
      ) : null}

      {isEditingBaseCost ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:py-10">
          <div className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Edit GP Costs
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Admin can update part and actual shipping costs after delivery.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingBaseCost(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gp-purchase-amount">Part cost</Label>
                  <Input
                    id="gp-purchase-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchaseAmountInput}
                    onChange={(event) =>
                      setPurchaseAmountInput(event.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gp-shipping-amount">Actual shipping cost</Label>
                  <Input
                    id="gp-shipping-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingAmountInput}
                    onChange={(event) =>
                      setShippingAmountInput(event.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gp-currency">Currency</Label>
                <Input
                  id="gp-currency"
                  value={currencyInput}
                  onChange={(event) => setCurrencyInput(event.target.value)}
                  placeholder="USD"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gp-edit-note">Edit note</Label>
                <Textarea
                  id="gp-edit-note"
                  rows={3}
                  value={baseCostEditNote}
                  onChange={(event) => setBaseCostEditNote(event.target.value)}
                  placeholder="Example: Yard refunded $300, so part cost was adjusted to net $100."
                />
              </div>
              {formError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingBaseCost(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleBaseCostSubmit()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Update costs'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isAdding || editingAdditionalCost ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:py-10">
          <div className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {editingAdditionalCost
                    ? 'Edit Additional Cost'
                    : 'Add Additional Cost'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This updates internal GP only.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeAdditionalCostForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="additional-cost-amount">Amount</Label>
                <Input
                  id="additional-cost-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="additional-cost-reason">Reason</Label>
                <Textarea
                  id="additional-cost-reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Liftgate, storage, re-delivery, inspection, or other reason"
                />
              </div>
              {formError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeAdditionalCostForm}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleAdditionalCostSubmit()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : editingAdditionalCost ? 'Update cost' : 'Save cost'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function GpMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/20 px-3 py-2">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function HistoryChangeList({ changes }: { changes: unknown }) {
  const fields = parseHistoryFields(changes);

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 grid gap-1">
      {fields.map((field) => (
        <div
          key={`${field.label}-${field.oldValue}-${field.newValue}`}
          className="grid gap-1 rounded-md bg-secondary/20 px-2 py-1 text-xs sm:grid-cols-[8rem_1fr]"
        >
          <span className="font-semibold text-muted-foreground">
            {field.label}
          </span>
          <span className="text-foreground">
            {field.oldValue ?? '—'} → {field.newValue ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

function parseHistoryFields(changes: unknown) {
  if (!changes || typeof changes !== 'object' || !('fields' in changes)) {
    return [];
  }

  const fields = (changes as { fields?: unknown }).fields;

  if (!Array.isArray(fields)) {
    return [];
  }

  return fields.flatMap((field) => {
    if (!field || typeof field !== 'object') {
      return [];
    }

    const record = field as {
      label?: unknown;
      oldValue?: unknown;
      newValue?: unknown;
    };

    if (typeof record.label !== 'string') {
      return [];
    }

    return [
      {
        label: record.label,
        oldValue:
          typeof record.oldValue === 'string' ? record.oldValue : null,
        newValue:
          typeof record.newValue === 'string' ? record.newValue : null,
      },
    ];
  });
}
