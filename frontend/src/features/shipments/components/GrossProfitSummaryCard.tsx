'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatCurrency } from '@/features/orders/lib/order-formatters';

type ShipmentCostLike = {
  purchaseAmount: number;
  shippingAmount: number;
  additionalAmount: number;
  grossProfit: number;
  currency: string;
  notes: string | null;
} | null;

export function GrossProfitSummaryCard({
  totalSaleAmount,
  currency,
  cost,
}: {
  totalSaleAmount: number;
  currency: string;
  cost: ShipmentCostLike;
}) {
  const purchaseAmount = cost?.purchaseAmount ?? 0;
  const shippingAmount = cost?.shippingAmount ?? 0;
  const additionalAmount = cost?.additionalAmount ?? 0;
  const totalCosts = purchaseAmount + shippingAmount + additionalAmount;
  const grossProfit = cost?.grossProfit ?? totalSaleAmount - totalCosts;
  const displayCurrency = cost?.currency ?? currency;
  const grossProfitTone =
    grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive';

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="pb-4">
        <CardDescription>GP calculation</CardDescription>
        <CardTitle className="text-2xl sm:text-[1.75rem]">
          {formatCurrency(totalSaleAmount, displayCurrency)} -{' '}
          {formatCurrency(totalCosts, displayCurrency)} ={' '}
          <span className={grossProfitTone}>
            {formatCurrency(grossProfit, displayCurrency)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GpMetric
          label="Total sale price"
          value={formatCurrency(totalSaleAmount, displayCurrency)}
        />
        <GpMetric
          label="Part purchased cost"
          value={formatCurrency(purchaseAmount, displayCurrency)}
        />
        <GpMetric
          label="Actual shipping cost"
          value={formatCurrency(shippingAmount, displayCurrency)}
          hint="Internal freight cost only"
        />
        <GpMetric
          label="Additional cost"
          value={formatCurrency(additionalAmount, displayCurrency)}
          hint={cost?.notes ?? 'No reason added'}
        />
      </CardContent>
    </Card>
  );
}

function GpMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
