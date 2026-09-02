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
  bolNumber,
  pickupNumber,
  proNumber,
  carrierName,
  isAdminOverride,
  requiresBolNumber,
  requiresCarrierName,
  requiresProNumber,
  lockedReason,
  onStatusChange,
  onBolNumberChange,
  onPickupNumberChange,
  onProNumberChange,
  onCarrierNameChange,
  onSubmit,
}: {
  nextStatuses: ShipmentStatus[];
  selectedStatus: ShipmentStatus | '';
  isUpdatingStatus: boolean;
  statusError: string | null;
  bolNumber?: string;
  pickupNumber?: string;
  proNumber: string;
  carrierName?: string;
  isAdminOverride?: boolean;
  requiresBolNumber?: boolean;
  requiresCarrierName?: boolean;
  requiresProNumber: boolean;
  lockedReason?: string | null;
  onStatusChange: (status: ShipmentStatus) => void;
  onBolNumberChange?: (bolNumber: string) => void;
  onPickupNumberChange?: (pickupNumber: string) => void;
  onProNumberChange: (proNumber: string) => void;
  onCarrierNameChange?: (carrierName: string) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Status update</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lockedReason ? (
          <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            {lockedReason}
          </div>
        ) : nextStatuses.length > 0 ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {isAdminOverride ? 'Shipment status' : 'Next allowed status'}
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

            {isAdminOverride ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ShipmentDataInput
                  label="BOL number"
                  value={bolNumber ?? ''}
                  onChange={(value) => onBolNumberChange?.(value)}
                  disabled={isUpdatingStatus}
                  placeholder="BOL-2026-001"
                />
                <ShipmentDataInput
                  label="Pickup No."
                  value={pickupNumber ?? ''}
                  onChange={(value) => onPickupNumberChange?.(value)}
                  disabled={isUpdatingStatus}
                  placeholder="PU-2026-001"
                />
                <ShipmentDataInput
                  label="PRO number"
                  value={proNumber}
                  onChange={onProNumberChange}
                  disabled={isUpdatingStatus}
                  placeholder="PRO-2026-001"
                />
                <ShipmentDataInput
                  label="Freight carrier"
                  value={carrierName ?? ''}
                  onChange={(value) => onCarrierNameChange?.(value)}
                  disabled={isUpdatingStatus}
                  placeholder="FedEx Freight"
                />
              </div>
            ) : null}

            {requiresProNumber && !isAdminOverride ? (
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
                (requiresBolNumber && (bolNumber ?? '').trim().length === 0) ||
                (requiresCarrierName &&
                  (carrierName ?? '').trim().length === 0) ||
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

function ShipmentDataInput({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
