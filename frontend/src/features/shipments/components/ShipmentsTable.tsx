'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type {
  ShipmentPaginationMeta,
  ShipmentSummary,
} from '../types/shipment.types';
import { ShippingStatusCell } from './ShippingStatusCell';

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

const columns: ColumnDef<ShipmentSummary>[] = [
  {
    accessorKey: 'order.salesNumber',
    header: 'Sale',
    meta: {
      className: 'w-[12%]',
    },
    cell: ({ row }) => (
      <div className="min-w-0 space-y-0.5">
        <Link
          href={`/shipments/${row.original.id}`}
          className="block truncate font-semibold text-[#d94d00] transition hover:text-[#ff5a00] dark:text-orange-300 dark:hover:text-orange-200"
        >
          {row.original.order.salesNumber ?? '—'}
        </Link>
        <p className="truncate text-xs font-medium text-muted-foreground">
          {row.original.order.orderNumber}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'order.customerName',
    header: 'Customer',
    meta: {
      className: 'w-[16%]',
    },
    cell: ({ row }) => (
      <p className="truncate font-medium text-foreground">
        {row.original.order.customerName}
      </p>
    ),
  },
  {
    accessorKey: 'order.createdBy.name',
    header: 'Advisor',
    meta: {
      className: 'w-[10%]',
    },
    cell: ({ row }) => (
      <p className="truncate font-medium text-foreground">
        {getFirstName(row.original.order.createdBy.name)}
      </p>
    ),
  },
  {
    accessorKey: 'order.partDescription',
    header: 'Part',
    meta: {
      className: 'w-[28%]',
    },
    cell: ({ row }) => (
      <p className="truncate text-sm text-foreground" title={row.original.order.partDescription}>
        {row.original.order.partDescription}
      </p>
    ),
  },
  {
    accessorKey: 'carrierName',
    header: 'PRO Details',
    meta: {
      className: 'w-[14%]',
    },
    cell: ({ row }) => (
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground">
          {row.original.carrierName ?? 'Carrier pending'}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.proNumber ?? 'PRO pending'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'currentStatus',
    header: 'Status',
    meta: {
      className: 'w-[12%]',
    },
    cell: ({ row }) => (
      <ShippingStatusCell
        status={row.original.currentStatus}
        orderStatus={row.original.order.status}
        orderDate={row.original.order.orderDate}
        fallbackDate={row.original.order.createdAt}
        bolNumber={row.original.bolNumber}
        proNumber={row.original.proNumber}
        hasReplacement={row.original.order.counts.replacementRequests > 0}
      />
    ),
  },
  {
    id: 'details',
    header: '',
    meta: {
      className: 'w-[8%]',
    },
    cell: ({ row }) => (
      <Link
        href={`/shipments/${row.original.id}`}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'rounded-lg px-2 text-[#d94d00] hover:bg-orange-50 hover:text-[#c94700] dark:text-orange-300 dark:hover:bg-orange-950/20',
        )}
      >
        View
        <ArrowRight className="h-4 w-4" />
      </Link>
    ),
  },
];

function getRangeLabel(meta: ShipmentPaginationMeta, currentCount: number) {
  if (meta.total === 0 || currentCount === 0) {
    return 'No results';
  }

  const normalizedPage =
    meta.totalPages > 0 ? Math.min(meta.page, meta.totalPages) : meta.page;
  const start = (normalizedPage - 1) * meta.limit + 1;
  const end = Math.min(start + currentCount - 1, meta.total);

  return `${start}-${end} of ${meta.total} shipments`;
}

export function ShipmentsTable({
  shipments,
  meta,
  isLoading,
  error,
  onRetry,
  onPageChange,
}: {
  shipments: ShipmentSummary[];
  meta: ShipmentPaginationMeta;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}) {
  const totalPages = meta.totalPages;

  return (
    <DataTable
      columns={columns}
      data={shipments}
      getRowId={(shipment) => shipment.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      density="compact"
      layout="fit"
      renderMobileCard={(shipment) => (
        <article className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/shipments/${shipment.id}`}
                className="block truncate text-base font-semibold text-[#d94d00] dark:text-orange-300"
              >
                {shipment.order.salesNumber ?? '—'}
              </Link>
              <p className="truncate text-xs font-medium text-muted-foreground">
                {shipment.order.orderNumber}
              </p>
            </div>
            <ShippingStatusCell
              status={shipment.currentStatus}
              orderStatus={shipment.order.status}
              orderDate={shipment.order.orderDate}
              fallbackDate={shipment.order.createdAt}
              bolNumber={shipment.bolNumber}
              proNumber={shipment.proNumber}
              hasReplacement={shipment.order.counts.replacementRequests > 0}
            />
          </div>

          <div className="mt-3 grid gap-2 text-sm">
            <MobileField label="Customer" value={shipment.order.customerName} />
            <MobileField label="Advisor" value={getFirstName(shipment.order.createdBy.name)} />
            <MobileField label="Part" value={shipment.order.partDescription} />
            <MobileField label="Carrier" value={shipment.carrierName ?? 'Carrier pending'} />
            <MobileField label="PRO" value={shipment.proNumber ?? 'PRO pending'} />
          </div>

          <Link
            href={`/shipments/${shipment.id}`}
            className={cn(
              buttonVariants({ variant: 'default', size: 'sm' }),
              'mt-3 h-9 w-full rounded-xl bg-[#ff5a00] text-white hover:bg-[#e65000]',
            )}
          >
            View shipment
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      )}
      emptyTitle="No shipments found"
      emptyDescription="Try a different search term or clear the current status filter."
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {getRangeLabel(meta, shipments.length)}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPreviousPage || isLoading}
              onClick={() => onPageChange(meta.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <span className="min-w-24 text-center text-sm text-muted-foreground">
              Page {totalPages === 0 ? 0 : meta.page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNextPage || isLoading}
              onClick={() => onPageChange(meta.page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    />
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="truncate font-medium text-foreground" title={value}>
        {value || '—'}
      </span>
    </div>
  );
}
