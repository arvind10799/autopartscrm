'use client';

import { cn } from '@/lib/utils/cn';
import {
  getPacificTodayDateInputValue,
  parseStoredDate,
} from '@/lib/utils/pacific-date';
import { formatShipmentStatusDisplay } from '../lib/shipment-formatters';
import type { OrderStatus } from '@/features/orders/types/order.types';
import type { ShipmentStatus, ShipmentStatusDisplay } from '../types/shipment.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ShippingStatusCellProps = {
  status?: ShipmentStatus | null;
  orderStatus?: OrderStatus | null;
  orderDate?: string | null;
  fallbackDate?: string | null;
  bolNumber?: string | null;
  proNumber?: string | null;
  className?: string;
};

const AGING_STATUSES = new Set<ShipmentStatusDisplay>([
  'PENDING',
  'LOCATING',
  'PRE_PROCESSING',
  'PURCHASE',
]);

function getPacificDateKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = parseStoredDate(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return getPacificTodayDateInputValue(parsedDate);
}

function dateKeyToUtcStart(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
}

function formatAgingDays(
  orderDate: string | null | undefined,
  fallbackDate: string | null | undefined,
) {
  const startDateKey =
    getPacificDateKey(orderDate) ?? getPacificDateKey(fallbackDate);

  if (!startDateKey) {
    return 'Aging pending';
  }

  const todayDateKey = getPacificTodayDateInputValue();
  const days = Math.max(
    0,
    Math.floor(
      (dateKeyToUtcStart(todayDateKey) - dateKeyToUtcStart(startDateKey)) /
        MS_PER_DAY,
    ),
  );

  return `${days} aging ${days === 1 ? 'day' : 'days'}`;
}

function getPrimaryLine({
  status,
  orderStatus,
  orderDate,
  fallbackDate,
  bolNumber,
  proNumber,
}: ShippingStatusCellProps) {
  if (orderStatus === 'REFUNDED') {
    return 'Refunded';
  }

  if (orderStatus === 'CANCELLED') {
    return 'Cancelled';
  }

  if (status === 'SHIPPED') {
    return bolNumber ? `BOL ${bolNumber}` : 'BOL pending';
  }

  if (status === 'IN_TRANSIT') {
    return proNumber ? `PRO ${proNumber}` : 'PRO pending';
  }

  if (status === 'DELIVERED') {
    return 'Delivered';
  }

  if (status === 'CANCELLED') {
    return 'Cancelled';
  }

  return formatAgingDays(orderDate, fallbackDate);
}

function getDisplayStatus({
  status,
  orderStatus,
}: Pick<ShippingStatusCellProps, 'status' | 'orderStatus'>): ShipmentStatusDisplay | null {
  if (orderStatus === 'REFUNDED') {
    return 'REFUNDED';
  }

  if (orderStatus === 'CANCELLED') {
    return 'CANCELLED';
  }

  return status ?? null;
}

function getSecondaryLine(status: ShipmentStatusDisplay | null | undefined) {
  if (!status) {
    return 'Pending';
  }

  if (status === 'SHIPPED') {
    return 'Shipped';
  }

  if (status === 'DELIVERED' || status === 'CANCELLED') {
    return null;
  }

  if (status === 'REFUNDED') {
    return null;
  }

  return formatShipmentStatusDisplay(status);
}

function isAgingMuted(status: ShipmentStatusDisplay | null | undefined) {
  return !status || AGING_STATUSES.has(status);
}

function getStatusTextClass(status: ShipmentStatusDisplay | null | undefined) {
  const statusTextClasses: Record<ShipmentStatusDisplay, string> = {
    PENDING: 'text-slate-600',
    LOCATING: 'text-sky-700',
    PRE_PROCESSING: 'text-amber-700',
    PURCHASE: 'text-orange-700',
    SHIPPED: 'text-blue-700',
    IN_TRANSIT: 'text-indigo-700',
    DELIVERED: 'text-emerald-700',
    DELAYED: 'text-amber-700',
    CANCELLED: 'text-rose-700',
    REFUNDED: 'text-violet-700',
  };

  return status ? statusTextClasses[status] : 'text-slate-600';
}

export function ShippingStatusCell(props: ShippingStatusCellProps) {
  const primaryLine = getPrimaryLine(props);
  const displayStatus = getDisplayStatus(props);
  const secondaryLine = getSecondaryLine(displayStatus);
  const statusTextClass = getStatusTextClass(displayStatus);

  return (
    <div className={cn('min-w-0 space-y-0.5', props.className)}>
      <p
        className={cn(
          'truncate text-xs font-semibold leading-4',
          isAgingMuted(displayStatus) ? 'text-muted-foreground' : statusTextClass,
        )}
        title={primaryLine}
      >
        {primaryLine}
      </p>
      {secondaryLine ? (
        <p className={cn('truncate text-sm font-semibold leading-5', statusTextClass)}>
          {secondaryLine}
        </p>
      ) : null}
    </div>
  );
}
