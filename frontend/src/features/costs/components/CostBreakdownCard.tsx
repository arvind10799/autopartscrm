import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatCostCurrency } from '../lib/cost-formatters';

export function CostBreakdownCard({
  currency,
  purchaseAmount,
  shippingCharges,
  additionalCharges,
  gp,
}: {
  currency: string;
  purchaseAmount: number;
  shippingCharges: number;
  additionalCharges: number;
  gp: number | null;
}) {
  const rows = [
    {
      label: 'purchaseAmount',
      value: purchaseAmount,
    },
    {
      label: 'shippingCharges',
      value: shippingCharges,
    },
    {
      label: 'additionalCharges',
      value: additionalCharges,
    },
    {
      label: 'GP',
      value: gp ?? 0,
      emphasize: true,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Cost breakdown</CardTitle>
        <CardDescription>
          Live currency-formatted breakdown of the shipment cost inputs and gross profit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
          >
            <span className="text-sm font-medium text-muted-foreground">
              {row.label}
            </span>
            <span
              className={
                row.emphasize
                  ? 'font-[var(--font-heading)] text-xl font-bold text-foreground'
                  : 'font-semibold text-foreground'
              }
            >
              {formatCostCurrency(row.value, currency)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
