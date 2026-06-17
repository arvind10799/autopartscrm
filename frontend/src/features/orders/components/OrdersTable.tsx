'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, PencilLine } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import {
  formatCurrency,
  formatDateTime,
} from '../lib/order-formatters';
import type { PaginationMeta, OrderSummary } from '../types/order.types';
import { ShipmentStatusBadge } from '@/features/shipments/components/ShipmentStatusBadge';

function buildColumns(
  onEdit: (orderId: string) => void,
): ColumnDef<OrderSummary>[] {
  return [
  {
    accessorKey: 'orderNumber',
    header: 'Order',
    cell: ({ row }) => (
      <div className="space-y-1">
        <Link
          href={`/orders/${row.original.id}`}
          className="font-semibold text-primary transition hover:text-primary/80"
        >
          {row.original.orderNumber}
        </Link>
        <p className="text-xs text-muted-foreground">
          Created {formatDateTime(row.original.createdAt)}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'customerName',
    header: 'Customer',
    cell: ({ row }) => (
      <p className="font-medium text-foreground">{row.original.customerName}</p>
    ),
  },
  {
    accessorKey: 'partDescription',
    header: 'Part',
    cell: ({ row }) => (
      <p className="max-w-xs text-sm text-foreground">
        {row.original.partDescription}
      </p>
    ),
  },
  {
    accessorKey: 'salePrice',
    header: 'Sale price',
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {formatCurrency(row.original.salePrice)}
      </span>
    ),
  },
  {
    accessorKey: 'quantity',
    header: 'Quantity',
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.quantity}</span>
    ),
  },
  {
    accessorKey: 'totalSaleAmount',
    header: 'Total sale amount',
    cell: ({ row }) => (
      <span className="font-semibold text-foreground">
        {formatCurrency(row.original.totalSaleAmount)}
      </span>
    ),
  },
  {
    accessorKey: 'latestShipmentStatus',
    header: 'Shipping status',
    cell: ({ row }) =>
      row.original.latestShipmentStatus ? (
        <ShipmentStatusBadge status={row.original.latestShipmentStatus} />
      ) : (
        <span className="text-sm text-muted-foreground">No shipment</span>
      ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(row.original.id)}>
          <PencilLine className="h-4 w-4" />
          Edit
        </Button>
        <Link
          href={`/orders/${row.original.id}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'px-2')}
        >
          View
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    ),
  },
  ];
}

function getRangeLabel(meta: PaginationMeta, currentCount: number) {
  if (meta.total === 0 || currentCount === 0) {
    return 'No results';
  }

  const start = (meta.page - 1) * meta.limit + 1;
  const end = start + currentCount - 1;

  return `${start}-${end} of ${meta.total} orders`;
}

export function OrdersTable({
  orders,
  meta,
  isLoading,
  error,
  onRetry,
  onPageChange,
  onEdit,
}: {
  orders: OrderSummary[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onEdit: (orderId: string) => void;
}) {
  const totalPages = meta.totalPages;
  const columns = buildColumns(onEdit);

  return (
    <DataTable
      columns={columns}
      data={orders}
      getRowId={(order) => order.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No orders found"
      emptyDescription="Try a different search term or clear the current status filter."
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {getRangeLabel(meta, orders.length)}
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
