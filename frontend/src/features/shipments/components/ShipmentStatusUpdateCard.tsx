'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
  requiresProNumber,
  onStatusChange,
  onProNumberChange,
  onSubmit,
}: {
  nextStatuses: ShipmentStatus[];
  selectedStatus: ShipmentStatus | '';
  isUpdatingStatus: boolean;
  statusError: string | null;
  proNumber: string;
  requiresProNumber: boolean;
  onStatusChange: (status: ShipmentStatus) => void;
  onProNumberChange: (proNumber: string) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Status update</CardTitle>
        <CardDescription>
          Update shipment progress with optimistic feedback while the backend request is in flight.
        </CardDescription>
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

            <Button
              className="w-full"
              disabled={
                !selectedStatus ||
                isUpdatingStatus ||
                (requiresProNumber && proNumber.trim().length === 0)
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
