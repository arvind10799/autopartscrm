import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function ShipmentMetricsCards({
  total,
  inTransitCount,
  delayedCount,
}: {
  total: number;
  inTransitCount: number;
  delayedCount: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total matching shipments</CardDescription>
          <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">{total}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Search and filters are backed by the Shipments API.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>In transit on this page</CardDescription>
          <CardTitle className="text-2xl tabular-nums text-sky-700 sm:text-[1.75rem]">
            {inTransitCount}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use this to focus the active delivery workload first.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Delayed on this page</CardDescription>
          <CardTitle className="text-2xl tabular-nums text-amber-700 sm:text-[1.75rem]">
            {delayedCount}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Delays are surfaced separately for fast exception handling.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
