import { Badge } from '@/components/ui/badge';

type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
}) {
  return (
    <Badge variant={tone} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
      {label}
    </Badge>
  );
}
