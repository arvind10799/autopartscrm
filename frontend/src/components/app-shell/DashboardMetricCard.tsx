import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface DashboardMetricCardProps {
  label: string;
  value: string;
  hint: string;
}

export function DashboardMetricCard({
  label,
  value,
  hint,
}: DashboardMetricCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-3 font-[var(--font-heading)] text-3xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
