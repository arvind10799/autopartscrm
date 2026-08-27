'use client';

import { Plus, X } from 'lucide-react';
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

export function GrossProfitSummaryCard({
  shipmentId,
  totalSaleAmount,
  currency,
  cost,
  additionalCosts = [],
  canAddAdditionalCost = false,
  onAdditionalCostAdded,
}: {
  shipmentId?: string;
  totalSaleAmount: number;
  currency: string;
  cost: ShipmentCostLike;
  additionalCosts?: ShipmentAdditionalCostLike[];
  canAddAdditionalCost?: boolean;
  onAdditionalCostAdded?: () => void | Promise<void>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
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
  const grossProfit = totalSaleAmount - totalCosts;
  const grossProfitTone =
    grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive';
  const canOpenForm = canAddAdditionalCost && Boolean(shipmentId) && Boolean(cost);

  const handleSubmit = async () => {
    const parsedAmount = Number(amount);
    const trimmedReason = reason.trim();

    if (!shipmentId || !canOpenForm) {
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
      await costsApi.createAdditionalCost(shipmentId, {
        amount: parsedAmount,
        reason: trimmedReason,
      });
      toast.success('Additional cost added', 'GP calculation has been updated.');
      setAmount('');
      setReason('');
      setIsAdding(false);
      await onAdditionalCostAdded?.();
    } catch (error) {
      setFormError(
        getErrorMessage(error, 'Unable to add additional cost right now.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardDescription>GP calculation</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">
              <span className={grossProfitTone}>
                {formatCurrency(grossProfit, displayCurrency)}
              </span>
            </CardTitle>
          </div>
          {canAddAdditionalCost ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canOpenForm}
              onClick={() => {
                setIsAdding(true);
                setFormError(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Additional Cost
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-5">
          <GpMetric
            label="Sale"
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
          Formula: sale - part cost - actual shipping cost - additional costs.
        </p>

        {additionalCosts.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Additional cost history
            </p>
            <div className="grid gap-2">
              {additionalCosts.map((entry) => (
                <div
                  key={entry.id}
                  className="grid gap-2 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2 text-sm sm:grid-cols-[8rem_1fr_auto]"
                >
                  <span className="font-semibold text-foreground">
                    {formatCurrency(entry.amount, displayCurrency)}
                  </span>
                  <span className="text-muted-foreground">{entry.reason}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.createdBy.name} · {formatDateTime(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>

      {isAdding ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:py-10">
          <div className="w-full max-w-lg rounded-[1.5rem] border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Add Additional Cost
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This updates internal GP only.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(false)}
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
                  onClick={() => setIsAdding(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save cost'}
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
