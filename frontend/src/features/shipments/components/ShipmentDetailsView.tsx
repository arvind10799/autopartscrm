'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DetailPageSkeleton } from '@/components/feedback/page-skeletons';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { useShipmentDetail } from '../hooks/useShipmentDetail';
import { useShipmentTimeline } from '../hooks/useShipmentTimeline';
import {
  formatShipmentStatusOptionLabel,
  getAllowedNextShipmentStatuses,
  getDefaultNextShipmentStatus,
} from '../lib/shipments.helpers';
import { formatShipmentDateTime } from '../lib/shipment-formatters';
import type { ShipmentStatus } from '../types/shipment.types';
import { ShipmentDetailGrid } from './ShipmentDetailGrid';
import { ShipmentOperationsSummaryCard } from './ShipmentOperationsSummaryCard';
import { ShipmentStatusUpdateCard } from './ShipmentStatusUpdateCard';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';
import { ShipmentTimeline } from './ShipmentTimeline';

export function ShipmentDetailsView({ shipmentId }: { shipmentId: string }) {
  const {
    shipment,
    isLoading,
    error,
    isUpdatingStatus,
    statusError,
    clearStatusError,
    updateStatus,
  } = useShipmentDetail(shipmentId);
  const {
    timeline,
    isLoading: isTimelineLoading,
    error: timelineError,
  } = useShipmentTimeline(shipmentId);
  const [selectedStatus, setSelectedStatus] = useState<ShipmentStatus | ''>('');
  const [proNumber, setProNumber] = useState('');

  useEffect(() => {
    if (!shipment) {
      setSelectedStatus('');
      setProNumber('');
      return;
    }

    setSelectedStatus(getDefaultNextShipmentStatus(shipment.currentStatus) ?? '');
    setProNumber('');
  }, [shipment]);

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !shipment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Shipment details</CardTitle>
          <CardDescription>
            The requested shipment could not be loaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'Shipment details are unavailable.'}
          </div>
          <Link
            href="/shipments"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to shipments
          </Link>
        </CardContent>
      </Card>
    );
  }

  const nextStatuses = getAllowedNextShipmentStatuses(shipment.currentStatus);

  const handleStatusSubmit = async () => {
    if (!selectedStatus) {
      return;
    }

    await updateStatus(selectedStatus, proNumber);
  };

  const handleStatusChange = (status: ShipmentStatus) => {
    clearStatusError();
    setSelectedStatus(status);
    setProNumber('');
  };

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="space-y-4">
          <Link
            href="/shipments"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit px-0')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to shipments
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="break-words text-3xl sm:text-[2rem]">
                  {shipment.bolNumber}
                </CardTitle>
                <ShipmentStatusBadge status={shipment.currentStatus} />
              </div>
              <CardDescription>
                {shipment.proNumber ? `PRO ${shipment.proNumber}` : 'PRO pending'} for
                order {shipment.order.orderNumber} with{' '}
                {shipment.carrierName ?? 'a pending carrier assignment'}.
              </CardDescription>
            </div>

            <div className="rounded-2xl border border-border/70 bg-secondary/35 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Current status
              </p>
              <p className="mt-2 font-[var(--font-heading)] text-2xl font-semibold text-foreground sm:text-[1.75rem]">
                {formatShipmentStatusOptionLabel(shipment.currentStatus)}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Carrier</CardDescription>
            <CardTitle className="text-2xl">
              {shipment.carrierName ?? 'Pending'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Assigned carrier for this shipment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Tracking events</CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
              {shipment.counts.events}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Event volume captured for this shipment timeline.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Last updated</CardDescription>
            <CardTitle className="text-2xl">
              {formatShipmentDateTime(shipment.updatedAt)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Most recent backend status or shipment data change.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6">
          <ShipmentDetailGrid shipment={shipment} />

          <ShipmentTimeline
            shipment={shipment}
            timeline={timeline}
            isLoading={isTimelineLoading}
            error={timelineError}
          />
        </div>

        <div className="grid gap-6">
          <ShipmentStatusUpdateCard
            nextStatuses={nextStatuses}
            selectedStatus={selectedStatus}
            isUpdatingStatus={isUpdatingStatus}
            statusError={statusError}
            proNumber={proNumber}
            requiresProNumber={
              selectedStatus === 'IN_TRANSIT' && !shipment.proNumber
            }
            onStatusChange={handleStatusChange}
            onProNumberChange={(value) => {
              clearStatusError();
              setProNumber(value);
            }}
            onSubmit={handleStatusSubmit}
          />

          <ShipmentOperationsSummaryCard shipment={shipment} />
        </div>
      </div>
    </section>
  );
}
