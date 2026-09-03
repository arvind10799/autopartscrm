'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { REPLACEMENT_STATUSES, type ReplacementRequest, type ReplacementStatus } from '../types/replacement.types';
import { formatReplacementStatus } from '../lib/replacements.helpers';

type ReplacementRequestModalProps = {
  replacement?: ReplacementRequest | null;
  isSaving: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    customerReason: string;
    yardUpdate?: string;
    replacementStatus: ReplacementStatus;
    replacementProNumber?: string;
    replacementCarrierName?: string;
  }) => Promise<void>;
};

export function ReplacementRequestModal({
  replacement,
  isSaving,
  error,
  onClose,
  onSubmit,
}: ReplacementRequestModalProps) {
  const [customerReason, setCustomerReason] = useState('');
  const [yardUpdate, setYardUpdate] = useState('');
  const [replacementProNumber, setReplacementProNumber] = useState('');
  const [replacementCarrierName, setReplacementCarrierName] = useState('');
  const [replacementStatus, setReplacementStatus] =
    useState<ReplacementStatus>('YARD_CONTACTED');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCustomerReason(replacement?.customerReason ?? '');
    setYardUpdate(replacement?.yardUpdate ?? '');
    setReplacementProNumber(replacement?.replacementProNumber ?? '');
    setReplacementCarrierName(replacement?.replacementCarrierName ?? '');
    setReplacementStatus(replacement?.replacementStatus ?? 'YARD_CONTACTED');
  }, [replacement]);

  const handleSubmit = async () => {
    if (!customerReason.trim()) {
      setFormError('Customer reason is required.');
      return;
    }

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

    setFormError(null);
    await onSubmit({
      customerReason,
      yardUpdate,
      replacementStatus,
      replacementProNumber,
      replacementCarrierName,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[1.5rem] border border-white/70 bg-card p-5 shadow-2xl shadow-slate-950/20 dark:border-slate-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Replacement
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">
              {replacement ? 'Update replacement request' : 'Create replacement request'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Track customer reason, yard progress, and status history.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Customer Reason
            <textarea
              value={customerReason}
              onChange={(event) => setCustomerReason(event.target.value)}
              className="min-h-28 rounded-2xl border border-input bg-background px-3.5 py-3 text-sm font-normal text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
              placeholder="Explain why the customer needs a replacement."
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Yard Update
            <textarea
              value={yardUpdate}
              onChange={(event) => setYardUpdate(event.target.value)}
              className="min-h-24 rounded-2xl border border-input bg-background px-3.5 py-3 text-sm font-normal text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
              placeholder="Add latest yard response, ETA, or replacement availability."
            />
          </label>

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
                onChange={(event) => setReplacementCarrierName(event.target.value)}
                placeholder="FedEx Freight"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              PRO Number
              <Input
                value={replacementProNumber}
                onChange={(event) => setReplacementProNumber(event.target.value)}
                placeholder="PRO123456"
              />
            </label>
          </div>

          {formError || error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError ?? error}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isSaving} onClick={() => void handleSubmit()}>
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {replacement ? 'Update Replacement' : 'Create Replacement'}
          </Button>
        </div>
      </div>
    </div>
  );
}
