import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { formatShipmentDateTime } from '../lib/shipment-formatters';
import type { ShipmentDetail } from '../types/shipment.types';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';

export function ShipmentDetailGrid({
  shipment,
  action,
}: {
  shipment: ShipmentDetail;
  action?: ReactNode;
}) {
  const displayStatus =
    shipment.order.status === 'REFUNDED' || shipment.order.status === 'CANCELLED'
      ? shipment.order.status
      : shipment.currentStatus;

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Shipment details</CardTitle>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3.5 sm:p-4">
        <DetailSection title="Shipment Info" tone="orange">
          <DetailBlock
            label="Current status"
            value={<ShipmentStatusBadge status={displayStatus} />}
          />
          <DetailBlock
            label="Shipped at"
            value={
              shipment.shippedAt
                ? formatShipmentDateTime(shipment.shippedAt)
                : 'Not shipped yet'
            }
          />
          <DetailBlock
            label="Delivered at"
            value={
              shipment.deliveredAt
                ? formatShipmentDateTime(shipment.deliveredAt)
                : 'Not delivered yet'
            }
          />
        </DetailSection>

        <DetailSection title="Linked Order" tone="blue">
          <DetailBlock label="Order number" value={shipment.order.orderNumber} />
          <DetailBlock
            label="Sales Number"
            value={shipment.order.salesNumber ?? 'Not provided'}
          />
          <DetailBlock label="Customer" value={shipment.order.customerName} />
          <DetailBlock
            label="Order date"
            value={
              shipment.order.orderDate
                ? formatShipmentDateTime(shipment.order.orderDate)
                : 'Not provided'
            }
          />
        </DetailSection>

        <DetailSection title="Carrier / Tracking" tone="teal">
          <DetailBlock label="BOL number" value={shipment.bolNumber ?? 'BOL pending'} />
          <DetailBlock
            label="Pickup No."
            value={shipment.pickupNumber ?? 'Pickup pending'}
          />
          <DetailBlock
            label="PRO number"
            value={shipment.proNumber ?? 'Pending until in transit'}
          />
          <DetailBlock
            label="Carrier"
            value={shipment.carrierName ?? 'Carrier pending'}
          />
        </DetailSection>
      </CardContent>
    </Card>
  );
}

function DetailSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: DetailTone;
  children: ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border p-3 shadow-sm', getDetailToneClassName(tone))}>
      <h3 className="text-xs font-bold uppercase tracking-[0.16em]">
        {title}
      </h3>
      <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[7.25rem_minmax(0,1fr)] gap-2 text-xs leading-5">
      <p className="font-bold uppercase text-foreground/85">
        {label}
      </p>
      <div className="min-w-0 whitespace-pre-wrap font-medium text-foreground">
        {value}
      </div>
    </div>
  );
}

type DetailTone = 'orange' | 'blue' | 'teal';

function getDetailToneClassName(tone: DetailTone) {
  const classes: Record<DetailTone, string> = {
    orange:
      'border-orange-200 bg-orange-50/70 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-200',
    blue:
      'border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200',
    teal:
      'border-teal-200 bg-teal-50/70 text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/20 dark:text-teal-200',
  };

  return classes[tone];
}
