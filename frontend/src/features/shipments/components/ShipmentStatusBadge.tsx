import { StatusBadge } from '@/components/ui/status-badge';
import { formatShipmentStatusDisplay } from '../lib/shipment-formatters';
import type { ShipmentStatusDisplay } from '../types/shipment.types';

const shipmentStatusTones: Record<
  ShipmentStatusDisplay,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  PENDING: 'neutral',
  LOCATING: 'info',
  PRE_PROCESSING: 'warning',
  PURCHASE: 'warning',
  SHIPPED: 'info',
  IN_TRANSIT: 'info',
  DELIVERED: 'success',
  DELAYED: 'warning',
  CANCELLED: 'danger',
  REFUNDED: 'warning',
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatusDisplay }) {
  return (
    <StatusBadge
      label={formatShipmentStatusDisplay(status)}
      tone={shipmentStatusTones[status]}
    />
  );
}
