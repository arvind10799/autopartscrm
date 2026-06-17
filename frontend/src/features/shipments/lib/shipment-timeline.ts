import { TRACKING_TIMELINE_STATUSES } from '../types/shipment.types';
import type {
  ShipmentDetail,
  ShipmentTimelineEvent,
  ShipmentTimeline,
  ShipmentTimelineEntryState,
  ShipmentTimelineStatusEntry,
  TrackingTimelineStatus,
} from '../types/shipment.types';

type TimelineStepDefinition = Readonly<{
  status: TrackingTimelineStatus;
  label: string;
  completedDescription: string;
  pendingDescription: string;
}>;

const TIMELINE_STEP_DEFINITIONS = {
  CREATED: {
    status: 'CREATED',
    label: 'Created',
    completedDescription:
      'Shipment record was created and is ready for operational updates.',
    pendingDescription: 'Shipment record is waiting to be created.',
  },
  PICKED: {
    status: 'PICKED',
    label: 'Picked',
    completedDescription:
      'Shipment has been picked and prepared for movement.',
    pendingDescription:
      'Awaiting pickup confirmation from warehouse or carrier.',
  },
  IN_TRANSIT: {
    status: 'IN_TRANSIT',
    label: 'In Transit',
    completedDescription:
      'Shipment is currently moving through the carrier network.',
    pendingDescription: 'Shipment has not entered transit yet.',
  },
  OUT_FOR_DELIVERY: {
    status: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    completedDescription: 'Shipment is on the final delivery run.',
    pendingDescription: 'Awaiting final-mile dispatch update.',
  },
  DELIVERED: {
    status: 'DELIVERED',
    label: 'Delivered',
    completedDescription: 'Shipment was delivered successfully.',
    pendingDescription: 'Delivery confirmation has not been recorded yet.',
  },
} as const satisfies Record<TrackingTimelineStatus, TimelineStepDefinition>;

const TRACKING_TIMELINE_EVENT_TYPE_ALIASES: Partial<
  Record<string, TrackingTimelineStatus>
> = {
  CREATED: 'CREATED',
  PICKED: 'PICKED',
  PICKED_UP: 'PICKED',
  PICKUP_CONFIRMED: 'PICKED',
  IN_TRANSIT: 'IN_TRANSIT',
  SHIPPED: 'IN_TRANSIT',
  DEPARTED: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
};

export function buildShipmentTimelineEntries(
  shipment: ShipmentDetail,
  timeline: ShipmentTimeline,
): ShipmentTimelineStatusEntry[] {
  const matchedEventsByStatus = mapTimelineEventsByStatus(timeline);
  const timelineEntries = TRACKING_TIMELINE_STATUSES.map((status) =>
    createTimelineEntry(
      shipment,
      status,
      matchedEventsByStatus.get(status) ?? null,
    ),
  );
  const activeIndex = getActiveTimelineIndex(timelineEntries);

  return timelineEntries.map((entry, index) => ({
    ...entry,
    state: getTimelineEntryState(index, activeIndex),
    description: resolveTimelineDescription(entry, index, activeIndex),
  }));
}

export function isShipmentTimelineAligned(
  shipment: ShipmentDetail,
  timeline: ShipmentTimeline,
): boolean {
  return timeline.shipment.id === shipment.id;
}

export function hasResolvedShipmentTimelineUpdates(
  entries: readonly ShipmentTimelineStatusEntry[],
): boolean {
  return entries.some(
    (entry) => entry.status !== 'CREATED' && entry.occurredAt !== null,
  );
}

function mapTimelineEventsByStatus(timeline: ShipmentTimeline) {
  const matchedEvents = new Map<TrackingTimelineStatus, ShipmentTimelineEvent>();

  for (const event of timeline.events) {
    const normalizedStatus = normalizeTrackingTimelineStatus(event.eventType);

    if (!normalizedStatus || matchedEvents.has(normalizedStatus)) {
      continue;
    }

    matchedEvents.set(normalizedStatus, event);
  }

  return matchedEvents;
}

function createTimelineEntry(
  shipment: ShipmentDetail,
  status: TrackingTimelineStatus,
  matchedEvent: ShipmentTimelineEvent | null,
): ShipmentTimelineStatusEntry {
  const stepDefinition = getTimelineStepDefinition(status);
  const occurredAt =
    matchedEvent?.eventAt ?? resolveTimelineOccurredAt(status, shipment);
  const description = normalizeOptionalText(matchedEvent?.description);
  const location = normalizeOptionalText(matchedEvent?.location);

  return {
    id: `${shipment.id}-${status.toLowerCase()}`,
    status,
    label: stepDefinition.label,
    description:
      description ??
      (occurredAt
        ? stepDefinition.completedDescription
        : stepDefinition.pendingDescription),
    location,
    occurredAt,
    state: 'upcoming',
  };
}

function getTimelineStepDefinition(
  status: TrackingTimelineStatus,
): TimelineStepDefinition {
  return TIMELINE_STEP_DEFINITIONS[status];
}

function resolveTimelineOccurredAt(
  status: TrackingTimelineStatus,
  shipment: ShipmentDetail,
): string | null {
  switch (status) {
    case 'CREATED':
      return shipment.createdAt;
    case 'IN_TRANSIT':
      return shipment.shippedAt;
    case 'DELIVERED':
      return shipment.deliveredAt;
    default:
      return null;
  }
}

function normalizeTrackingTimelineStatus(
  eventType: string,
): TrackingTimelineStatus | null {
  const normalizedEventType = eventType.trim().toUpperCase().replace(/[\s-]+/g, '_');

  return TRACKING_TIMELINE_EVENT_TYPE_ALIASES[normalizedEventType] ?? null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

function getActiveTimelineIndex(entries: ShipmentTimelineStatusEntry[]): number {
  const deliveredIndex = entries.findIndex(
    (entry) => entry.status === 'DELIVERED' && entry.occurredAt,
  );

  if (deliveredIndex >= 0) {
    return deliveredIndex;
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.occurredAt) {
      return index;
    }
  }

  return 0;
}

function getTimelineEntryState(
  index: number,
  activeIndex: number,
): ShipmentTimelineEntryState {
  if (index < activeIndex) {
    return 'completed';
  }

  if (index === activeIndex) {
    return 'current';
  }

  return 'upcoming';
}

function resolveTimelineDescription(
  entry: ShipmentTimelineStatusEntry,
  index: number,
  activeIndex: number,
): string {
  if (index < activeIndex && !entry.occurredAt) {
    return 'Reached before a later tracked milestone. Exact timestamp was not captured.';
  }

  return entry.description;
}
