'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatShipmentDateTime } from '../lib/shipment-formatters';
import type {
  ShipmentPaginationMeta,
  ShipmentSummary,
} from '../types/shipment.types';
import { ShipmentStatusBadge } from './ShipmentStatusBadge';

const columns: ColumnDef<ShipmentSummary>[] = [
  {
    accessorKey: 'bolNumber',
    header: 'BOL',
    cell: ({ row }) => (
      <div className="space-y-1">
        <Link
          href={`/shipments/${row.original.id}`}
          className="font-semibold text-primary transition hover:text-primary/80"
        >
          {row.original.bolNumber}
        </Link>
        <p className="text-xs text-muted-foreground">
          Updated {formatShipmentDateTime(row.original.updatedAt)}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'proNumber',
    header: 'PRO',
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {row.original.proNumber ?? 'Pending'}
      </span>
    ),
  },
  {
    accessorKey: 'carrierName',
    header: 'Carrier',
    cell: ({ row }) => (
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {row.original.carrierName ?? 'Carrier pending'}
        </p>
        <p className="text-xs text-muted-foreground">
          Order {row.original.order.orderNumber}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'currentStatus',
    header: 'Current status',
    cell: ({ row }) => <ShipmentStatusBadge status={row.original.currentStatus} />,
  },
  {
    id: 'counts',
    header: 'Tracking',
    cell: ({ row }) => (
      <p className="text-sm text-muted-foreground">
        {row.original.counts.events} events | {row.original.counts.notes} notes
      </p>
    ),
  },
  {
    id: 'details',
    header: '',
    cell: ({ row }) => (
      <Link
        href={`/shipments/${row.original.id}`}
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'px-2')}
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
