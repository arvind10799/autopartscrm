import { StatusBadge } from '@/components/ui/status-badge';
import { formatShipmentStatus } from '../lib/shipment-formatters';
import type { ShipmentStatus } from '../types/shipment.types';

const shipmentStatusTones: Record<
  ShipmentStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  PENDING: 'neutral',
  IN_TRANSIT: 'info',
  DELIVERED: 'success',
  DELAYED: 'warning',
  CANCELLED: 'danger',
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <StatusBadge
      label={formatShipmentStatus(status)}
      tone={shipmentStatusTones[status]}
    />
  );
}
