import { Badge } from '@/components/ui/badge';
import type { ReplacementStatus } from '../types/replacement.types';
import { formatReplacementStatus } from '../lib/replacements.helpers';

const STATUS_VARIANTS: Record<
  ReplacementStatus,
  'default' | 'secondary' | 'outline' | 'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  YARD_CONTACTED: 'info',
  WAITING_YARD_RESPONSE: 'warning',
  APPROVED: 'success',
  SHIPPED: 'default',
  IN_TRANSIT: 'info',
  DELIVERED: 'success',
};

export function ReplacementStatusBadge({
  status,
}: {
  status: ReplacementStatus;
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'neutral'}>
      {formatReplacementStatus(status)}
    </Badge>
  );
}
