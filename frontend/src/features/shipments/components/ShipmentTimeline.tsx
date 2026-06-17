'use client';

import { CheckCheck, CircleDashed, Clock3, MapPin, Truck } from 'lucide-react';
import { TimelineSkeleton } from '@/components/feedback/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  buildShipmentTimelineEntries,
  hasResolvedShipmentTimelineUpdates,
  isShipmentTimelineAligned,
} from '../lib/shipment-timeline';
import { formatShipmentDateTime } from '../lib/shipment-formatters';
import type {
  ShipmentDetail,
  ShipmentTimeline as ShipmentTimelineData,
  ShipmentTimelineEntryState,
  ShipmentTimelineStatusEntry,
} from '../types/shipment.types';

const TIMELINE_TITLE = 'Tracking timeline';
const TIMELINE_DESCRIPTION =
  'Follow the shipment status history from creation through final delivery.';
type TimelineBadgeVariant = 'default' | 'secondary' | 'outline';

export function ShipmentTimeline({
  shipment,
  timeline,
  isLoading,
  error,
}: {
  shipment: ShipmentDetail;
  timeline: ShipmentTimelineData | null;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (error || !timeline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{TIMELINE_TITLE}</CardTitle>
          <CardDescription>
            Tracking events could not be loaded for this shipment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'Tracking timeline is unavailable.'}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isShipmentTimelineAligned(shipment, timeline)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{TIMELINE_TITLE}</CardTitle>
          <CardDescription>
            Tracking events could not be aligned with this shipment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            Tracking timeline data is out of sync. Refresh the page and try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  const entries = buildShipmentTimelineEntries(shipment, timeline);
  const hasResolvedUpdates = hasResolvedShipmentTimelineUpdates(entries);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{TIMELINE_TITLE}</CardTitle>
        <CardDescription>{TIMELINE_DESCRIPTION}</CardDescription>
      </CardHeader>

      <CardContent>
        {!hasResolvedUpdates ? (
          <div className="mb-5 rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            Tracking updates beyond shipment creation have not been recorded yet.
          </div>
        ) : null}
        <ol className="space-y-0">
          {entries.map((entry, index) => (
            <ShipmentTimelineItem
              key={entry.id}
              entry={entry}
              isLast={index === entries.length - 1}
            />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function ShipmentTimelineItem({
  entry,
  isLast,
}: {
  entry: ShipmentTimelineStatusEntry;
  isLast: boolean;
}) {
  return (
    <li
      className="relative grid gap-4 pb-8 last:pb-0 sm:grid-cols-[2rem_1fr]"
      aria-current={entry.state === 'current' ? 'step' : undefined}
    >
      <div className="relative flex w-8 justify-center sm:w-full">
        <span className={getTimelineMarkerClasses(entry.state)}>
          {getTimelineMarkerIcon(entry)}
        </span>
        {!isLast ? <span className={getTimelineRailClasses(entry.state)} /> : null}
      </div>

      <div className="flex-1 rounded-2xl border border-border/70 bg-secondary/15 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">{entry.label}</p>
              <Badge variant={getTimelineBadgeVariant(entry.state)}>
                {getTimelineStateLabel(entry.state)}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">{entry.description}</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            <span>{formatShipmentDateTime(entry.occurredAt, 'Pending timestamp')}</span>
          </div>
        </div>

        {entry.location ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{entry.location}</span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function getTimelineMarkerIcon(entry: ShipmentTimelineStatusEntry) {
  if (entry.state === 'completed') {
    return <CheckCheck className="h-4 w-4" />;
  }

  if (entry.state === 'current') {
    return <Truck className="h-4 w-4" />;
  }

  return <CircleDashed className="h-4 w-4" />;
}

function getTimelineMarkerClasses(
  state: ShipmentTimelineEntryState,
): string {
  return cn(
    'relative z-10 mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border',
    state === 'completed'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
      : state === 'current'
        ? 'border-primary/30 bg-primary/10 text-primary'
        : 'border-border bg-background text-muted-foreground',
  );
}

function getTimelineRailClasses(
  state: ShipmentTimelineEntryState,
): string {
  return cn(
    'absolute left-1/2 top-9 h-[calc(100%-1.5rem)] w-px -translate-x-1/2',
    state === 'upcoming' ? 'bg-border/80' : 'bg-primary/30',
  );
}

function getTimelineBadgeVariant(
  state: ShipmentTimelineEntryState,
): TimelineBadgeVariant {
  if (state === 'current') {
    return 'default';
  }

  if (state === 'completed') {
    return 'secondary';
  }

  return 'outline';
}

function getTimelineStateLabel(
  state: ShipmentTimelineEntryState,
): string {
  if (state === 'completed') {
    return 'Completed';
  }

  if (state === 'current') {
    return 'Current';
  }

  return 'Upcoming';
}
