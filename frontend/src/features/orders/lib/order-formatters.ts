import type { OrderPaymentMethod, OrderStatus } from '../types/order.types';
import {
  formatPacificDateOnly,
  formatPacificDateTime,
} from '@/lib/utils/pacific-date';

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase() || 'USD';
  const cachedFormatter = currencyFormatterCache.get(normalizedCurrency);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: normalizedCurrency,
    maximumFractionDigits: 2,
  });

  currencyFormatterCache.set(normalizedCurrency, formatter);
  return formatter;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  PARTIALLY_PAID: 'Partially paid',
  CONFIRMED: 'Paid',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const ORDER_PAYMENT_METHOD_LABELS: Record<OrderPaymentMethod, string> = {
  WIRE_TRANSFER: 'Wire payment',
  CREDIT_CARD: 'Credit card payment',
  INVOICE: 'Invoice',
  OTHER: 'Other',
};

export function formatCurrency(value: number, currency = 'USD'): string {
  return getCurrencyFormatter(currency).format(value);
}

export function formatOrderStatus(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

export function formatOrderPaymentMethod(paymentMethod: OrderPaymentMethod): string {
  return ORDER_PAYMENT_METHOD_LABELS[paymentMethod];
}

export function formatDateTime(value: string): string {
  return formatPacificDateTime(value);
}

export function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return '';
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000),
  );

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds} sec ago`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${elapsedMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} ${elapsedHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 30) {
    return `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);

  if (elapsedMonths < 12) {
    return `${elapsedMonths} ${elapsedMonths === 1 ? 'month' : 'months'} ago`;
  }

  const elapsedYears = Math.floor(elapsedMonths / 12);
  return `${elapsedYears} ${elapsedYears === 1 ? 'year' : 'years'} ago`;
}

export function formatDate(value: string): string {
  return formatPacificDateOnly(value, value);
}
