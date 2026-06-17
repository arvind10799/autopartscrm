import type {
  ShipmentStatus,
  TrackingTimelineStatus,
} from '../types/shipment.types';

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: 'Pending',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  DELAYED: 'Delayed',
  CANCELLED: 'Cancelled',
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

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return fallback;
  }

  return dateTimeFormatter.format(parsedDate);
}
