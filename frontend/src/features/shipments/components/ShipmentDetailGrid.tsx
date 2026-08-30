import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl">Shipment details</CardTitle>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
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
        <DetailBlock
          label="Current status"
          value={<ShipmentStatusBadge status={displayStatus} />}
        />
        <DetailBlock label="Order number" value={shipment.order.orderNumber} />
        <DetailBlock label="Customer" value={shipment.order.customerName} />
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
      </CardContent>
    </Card>
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
    <div className="rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 break-words text-sm leading-5 text-foreground">{value}</div>
    </div>
  );
}
