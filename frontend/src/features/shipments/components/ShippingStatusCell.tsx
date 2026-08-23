'use client';

import { cn } from '@/lib/utils/cn';
import { formatShipmentStatus } from '../lib/shipment-formatters';
import type { ShipmentStatus } from '../types/shipment.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ShippingStatusCellProps = {
  status?: ShipmentStatus | null;
  orderDate?: string | null;
  fallbackDate?: string | null;
  bolNumber?: string | null;
  proNumber?: string | null;
  className?: string;
};

const AGING_STATUSES = new Set<ShipmentStatus>([
  'PENDING',
  'LOCATING',
  'PRE_PROCESSING',
  'PURCHASE',
]);

function parseDateStart(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    return new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
    );
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
  );
}

function formatAgingDays(
  orderDate: string | null | undefined,
  fallbackDate: string | null | undefined,
) {
  const startDate = parseDateStart(orderDate) ?? parseDateStart(fallbackDate);

  if (!startDate) {
    return 'Aging pending';
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(
    0,
    Math.floor((todayStart.getTime() - startDate.getTime()) / MS_PER_DAY),
  );

  return `${days} aging ${days === 1 ? 'day' : 'days'}`;
}

function getPrimaryLine({
  status,
  orderDate,
  fallbackDate,
  bolNumber,
  proNumber,
}: ShippingStatusCellProps) {
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

function getSecondaryLine(status: ShipmentStatus | null | undefined) {
  if (!status) {
    return 'Pending';
  }

  if (status === 'SHIPPED') {
    return 'Shipped';
  }

  if (status === 'DELIVERED' || status === 'CANCELLED') {
    return null;
  }

  return formatShipmentStatus(status);
}

function isAgingMuted(status: ShipmentStatus | null | undefined) {
  return !status || AGING_STATUSES.has(status);
}

export function ShippingStatusCell(props: ShippingStatusCellProps) {
  const primaryLine = getPrimaryLine(props);
  const secondaryLine = getSecondaryLine(props.status);

  return (
    <div className={cn('min-w-0 space-y-0.5', props.className)}>
      <p
        className={cn(
          'truncate text-xs font-semibold leading-4',
          isAgingMuted(props.status) ? 'text-muted-foreground' : 'text-foreground',
        )}
        title={primaryLine}
      >
        {primaryLine}
      </p>
      {secondaryLine ? (
        <p className="truncate text-sm font-semibold leading-5 text-foreground">
          {secondaryLine}
        </p>
      ) : null}
    </div>
  );
}
