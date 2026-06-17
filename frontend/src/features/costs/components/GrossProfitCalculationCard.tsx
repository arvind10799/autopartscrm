import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatCostCurrency } from '../lib/cost-formatters';

export function GrossProfitCalculationCard({
  currency,
  revenue,
  totalCosts,
  gp,
}: {
  currency: string;
  revenue: number | null;
  totalCosts: number;
  gp: number | null;
}) {
  const grossProfitTone =
    gp === null ? 'text-muted-foreground' : gp >= 0 ? 'text-emerald-700' : 'text-destructive';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">GP calculation</CardTitle>
        <CardDescription>
          Real-time gross profit based on order revenue minus the shipment cost inputs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-secondary/35 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Current GP
          </p>
          <p
            className={`mt-3 font-[var(--font-heading)] text-3xl font-semibold tabular-nums sm:text-[2rem] ${grossProfitTone}`}
          >
            {gp === null ? 'Select a shipment' : formatCostCurrency(gp, currency)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Revenue {revenue === null ? 'will load after shipment selection.' : 'is pulled from the linked order.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Order revenue
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {revenue === null ? 'Pending' : formatCostCurrency(revenue, currency)}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Total entered costs
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {formatCostCurrency(totalCosts, currency)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/15 px-4 py-3 text-sm text-muted-foreground">
          GP formula: revenue - purchase amount - shipping charges - additional charges
        </div>
      </CardContent>
    </Card>
  );
}
