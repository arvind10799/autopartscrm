import { StatusBadge } from '@/components/ui/status-badge';
import { formatOrderStatus } from '../lib/order-formatters';
import type { OrderStatus } from '../types/order.types';

const statusTones: Record<
  OrderStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
  DRAFT: 'neutral',
  PARTIALLY_PAID: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusBadge label={formatOrderStatus(status)} tone={statusTones[status]} />;
}
