import type {
  ShipmentStatusDisplay,
  ShipmentStatus,
  TrackingTimelineStatus,
} from '../types/shipment.types';
import { formatPacificDateTime } from '@/lib/utils/pacific-date';

const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: 'Pending',
  LOCATING: 'Locating',
  PRE_PROCESSING: 'Pre Processing',
  PURCHASE: 'Purchase',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  DELAYED: 'Delayed',
  CANCELLED: 'Cancelled',
};

const SHIPMENT_STATUS_DISPLAY_LABELS: Record<ShipmentStatusDisplay, string> = {
  ...SHIPMENT_STATUS_LABELS,
  REFUNDED: 'Refunded',
};

const TRACKING_TIMELINE_STATUS_LABELS: Record<TrackingTimelineStatus, string> = {
  CREATED: 'Created',
  PICKED: 'Picked',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
};

export function formatShipmentStatus(status: ShipmentStatus): string {
  return SHIPMENT_STATUS_LABELS[status];
}

export function formatShipmentStatusDisplay(status: ShipmentStatusDisplay): string {
  return SHIPMENT_STATUS_DISPLAY_LABELS[status];
}

export function formatTrackingTimelineStatus(
  status: TrackingTimelineStatus,
): string {
  return TRACKING_TIMELINE_STATUS_LABELS[status];
}

export function formatShipmentDateTime(
  value: string | null | undefined,
  fallback = 'Unknown time',
): string {
  if (!value) {
    return fallback;
  }

  return formatPacificDateTime(value, fallback);
}
