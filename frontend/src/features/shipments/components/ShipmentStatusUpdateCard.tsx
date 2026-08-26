'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  formatShipmentStatusOptionLabel,
  isShipmentStatus,
} from '../lib/shipments.helpers';
import type { ShipmentStatus } from '../types/shipment.types';

export function ShipmentStatusUpdateCard({
  nextStatuses,
  selectedStatus,
  isUpdatingStatus,
  statusError,
  proNumber,
  additionalAmount,
  additionalCostReason,
  requiresProNumber,
  showAdditionalCostFields,
  onStatusChange,
  onProNumberChange,
  onAdditionalAmountChange,
  onAdditionalCostReasonChange,
  onSubmit,
}: {
  nextStatuses: ShipmentStatus[];
  selectedStatus: ShipmentStatus | '';
  isUpdatingStatus: boolean;
  statusError: string | null;
  proNumber: string;
  additionalAmount: string;
  additionalCostReason: string;
  requiresProNumber: boolean;
  showAdditionalCostFields: boolean;
  onStatusChange: (status: ShipmentStatus) => void;
  onProNumberChange: (proNumber: string) => void;
  onAdditionalAmountChange: (amount: string) => void;
  onAdditionalCostReasonChange: (reason: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const requiresAdditionalCostReason =
    showAdditionalCostFields && Number(additionalAmount || 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Status update</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextStatuses.length > 0 ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Next allowed status
              </p>
              <Select
                value={selectedStatus}
                onChange={(event) => {
                  const nextStatus = event.target.value;

                  if (isShipmentStatus(nextStatus)) {
                    onStatusChange(nextStatus);
                  }
                }}
                disabled={isUpdatingStatus}
              >
                {nextStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatShipmentStatusOptionLabel(status)}
                  </option>
                ))}
              </Select>
            </div>

            {requiresProNumber ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  PRO number
                </p>
                <Input
                  value={proNumber}
                  onChange={(event) => onProNumberChange(event.target.value)}
                  disabled={isUpdatingStatus}
                  placeholder="PRO-2026-001"
                />
              </div>
            ) : null}

            {showAdditionalCostFields ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Additional cost
                  </p>
                  <Input
                    value={additionalAmount}
                    type="number"
                    min="0"
                    step="0.01"
                    onChange={(event) =>
                      onAdditionalAmountChange(event.target.value)
                    }
                    disabled={isUpdatingStatus}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Additional cost reason
                  </p>
                  <Input
                    value={additionalCostReason}
                    onChange={(event) =>
                      onAdditionalCostReasonChange(event.target.value)
                    }
                    disabled={isUpdatingStatus}
                    placeholder="Liftgate, storage, re-delivery, or other reason"
                  />
                  <p className="text-xs text-muted-foreground">
                    Required only when additional cost is greater than zero.
                  </p>
                </div>
              </>
            ) : null}

            <Button
              className="w-full"
              disabled={
                !selectedStatus ||
                isUpdatingStatus ||
                (requiresProNumber && proNumber.trim().length === 0) ||
                (requiresAdditionalCostReason &&
                  additionalCostReason.trim().length === 0)
              }
              onClick={() => void onSubmit()}
            >
              {isUpdatingStatus ? 'Updating status...' : 'Update shipment status'}
            </Button>
          </>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            This shipment is in a terminal state and has no further status transitions.
          </div>
        )}

        {statusError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {statusError}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
