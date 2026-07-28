import {
  formatDate,
  formatDateTime,
} from '@/features/orders/lib/order-formatters';
import type { LeadQuoteCurrency } from '../types/lead.types';

export { formatDate, formatDateTime };

export function formatLeadCurrency(
  value: number,
  currency: LeadQuoteCurrency,
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
