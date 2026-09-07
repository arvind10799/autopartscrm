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
    useState<ReplacementStatus>('WAITING_YARD_RESPONSE');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCustomerReason(replacement?.customerReason ?? '');
    setYardUpdate(replacement?.yardUpdate ?? '');
    setReplacementProNumber(replacement?.replacementProNumber ?? '');
    setReplacementCarrierName(replacement?.replacementCarrierName ?? '');
    setReplacementStatus(
      replacement?.replacementStatus ?? 'WAITING_YARD_RESPONSE',
    );
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-slate-950/25"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#ff5a00]">
              Replacement
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-foreground">
              {replacement ? 'Update replacement request' : 'Create replacement request'}
            </h2>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-3 px-4 py-3">
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Customer Reason
            <textarea
              value={customerReason}
              onChange={(event) => setCustomerReason(event.target.value)}
              rows={3}
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              placeholder="Explain why the customer needs a replacement."
            />
          </label>

          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Yard Update
            <textarea
              value={yardUpdate}
              onChange={(event) => setYardUpdate(event.target.value)}
              rows={3}
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              placeholder="Add latest yard response, ETA, or replacement availability."
            />
          </label>

          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Replacement Status
            <Select
              className="h-9 normal-case tracking-normal"
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
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Freight Carrier
              <Input
                className="h-9 normal-case tracking-normal"
                value={replacementCarrierName}
                onChange={(event) => setReplacementCarrierName(event.target.value)}
                placeholder="FedEx Freight"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              PRO Number
              <Input
                className="h-9 normal-case tracking-normal"
                value={replacementProNumber}
                onChange={(event) => setReplacementProNumber(event.target.value)}
                placeholder="PRO123456"
              />
            </label>
          </div>

          {formError || error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {formError ?? error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/70 px-4 py-3">
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-lg bg-[#ff5a00] px-3 text-xs text-white hover:bg-[#e65000]"
            disabled={isSaving}
            onClick={() => void handleSubmit()}
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {replacement ? 'Update Replacement' : 'Create Replacement'}
          </Button>
        </div>
      </div>
    </div>
  );
}
