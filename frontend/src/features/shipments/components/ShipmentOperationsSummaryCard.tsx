import type { ReactNode } from 'react';
import { Clock4, Route, Truck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ShipmentDetail } from '../types/shipment.types';

export function ShipmentOperationsSummaryCard({
  shipment,
}: {
  shipment: ShipmentDetail;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Operations summary</CardTitle>
        <CardDescription>
          Quick operational signals attached to this shipment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SummaryRow
          icon={<Truck className="h-4 w-4" />}
          label="Carrier"
          value={shipment.carrierName ?? 'Pending'}
        />
        <SummaryRow
          icon={<Route className="h-4 w-4" />}
          label="Notes"
          value={String(shipment.counts.notes)}
        />
        <SummaryRow
          icon={<Clock4 className="h-4 w-4" />}
          label="Events"
          value={String(shipment.counts.events)}
        />
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-secondary/20 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3 text-sm text-foreground">
        <span className="rounded-full bg-primary/10 p-2 text-primary">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <span className="shrink-0 text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}
