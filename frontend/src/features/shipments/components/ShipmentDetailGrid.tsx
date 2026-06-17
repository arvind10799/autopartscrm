import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatShipmentDateTime } from '../lib/shipment-formatters';
import type { ShipmentDetail } from '../types/shipment.types';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';

export function ShipmentDetailGrid({ shipment }: { shipment: ShipmentDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Shipment details</CardTitle>
        <CardDescription>
          Review BOL, PRO, carrier, and related order context for this shipment.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <DetailBlock label="BOL number" value={shipment.bolNumber} />
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
          value={<ShipmentStatusBadge status={shipment.currentStatus} />}
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
    <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-sm text-foreground">{value}</div>
    </div>
  );
}
