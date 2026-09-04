import { Badge } from '@/components/ui/badge';
import type { ReplacementStatus } from '../types/replacement.types';
import { formatReplacementStatus } from '../lib/replacements.helpers';

const STATUS_VARIANTS: Record<
  ReplacementStatus,
  'default' | 'secondary' | 'outline' | 'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  WAITING_YARD_RESPONSE: 'warning',
  YARD_CONTACTED: 'info',
  AGREED: 'success',
  DISAGREED: 'danger',
  YARD_REFUNDING: 'warning',
  YARD_DOESNT_HAVE_REPLACEMENT: 'danger',
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
