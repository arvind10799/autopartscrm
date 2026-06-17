import type {
  OrderPaymentMethod,
  OrderStatus,
} from '../types/order.types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
});

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  PARTIALLY_PAID: 'Partially paid',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const ORDER_PAYMENT_METHOD_LABELS: Record<OrderPaymentMethod, string> = {
  WIRE_TRANSFER: 'Wire payment',
  CREDIT_CARD: 'Credit card payment',
};

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatOrderStatus(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

export function formatOrderPaymentMethod(paymentMethod: OrderPaymentMethod): string {
  return ORDER_PAYMENT_METHOD_LABELS[paymentMethod];
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(parseStoredDate(value));
}

export function formatDate(value: string): string {
  return dateFormatter.format(parseStoredDate(value));
}

function parseStoredDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}
