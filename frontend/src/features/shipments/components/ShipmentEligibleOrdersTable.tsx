'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/features/orders/lib/order-formatters';
import type {
  OrderSummary,
  PaginationMeta,
} from '@/features/orders/types/order.types';
import { ShippingStatusCell } from './ShippingStatusCell';

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function getRangeLabel(meta: PaginationMeta, currentCount: number) {
  if (meta.total === 0 || currentCount === 0) {
    return 'No eligible orders';
  }

  const start = (meta.page - 1) * meta.limit + 1;
  const end = start + currentCount - 1;

  return `${start}-${end} of ${meta.total} eligible orders`;
}

export function ShipmentEligibleOrdersTable({
  orders,
  meta,
  isLoading,
  error,
  onRetry,
  onPageChange,
  selectedOrderId,
  onSelectOrder,
}: {
  orders: OrderSummary[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  selectedOrderId: string | null;
  onSelectOrder: (order: OrderSummary) => void;
}) {
  const columns: ColumnDef<OrderSummary>[] = [
    {
      accessorKey: 'salesNumber',
      header: 'Sale',
      meta: {
        className: 'w-[12%]',
      },
      cell: ({ row }) => (
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-semibold text-[#d94d00] dark:text-orange-300">
            {row.original.salesNumber ?? '—'}
          </p>
          <p className="truncate text-xs font-medium text-muted-foreground">
            {row.original.orderNumber}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      meta: {
        className: 'w-[16%]',
      },
      cell: ({ row }) => (
        <p className="truncate font-medium text-foreground">
          {row.original.customerName}
        </p>
      ),
    },
    {
      id: 'agent',
      header: 'Advisor',
      meta: {
        className: 'w-[10%]',
      },
      cell: ({ row }) => (
        <p className="truncate font-medium text-foreground">
          {getFirstName(row.original.createdBy.name)}
        </p>
      ),
    },
    {
      accessorKey: 'partDescription',
      header: 'Part',
      meta: {
        className: 'w-[30%]',
      },
      cell: ({ row }) => (
        <p className="truncate text-sm text-foreground" title={row.original.partDescription}>
          {row.original.partDescription}
        </p>
      ),
    },
    {
      accessorKey: 'totalSaleAmount',
      header: 'Sale Amount',
      meta: {
        className: 'w-[12%]',
      },
      cell: ({ row }) => (
        <span className="block truncate font-semibold text-foreground">
          {formatCurrency(row.original.totalSaleAmount, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'latestShipmentStatus',
      header: 'Status',
      meta: {
        className: 'w-[12%]',
      },
      cell: ({ row }) => (
        <ShippingStatusCell
          status={row.original.latestShipmentStatus}
          orderStatus={row.original.status}
          orderDate={row.original.intakeDetails?.orderDate}
          fallbackDate={row.original.createdAt}
          bolNumber={row.original.latestShipment?.bolNumber}
          proNumber={row.original.latestShipment?.proNumber}
          hasReplacement={row.original.counts.replacementRequests > 0}
        />
      ),
    },
    {
      id: 'action',
      header: '',
      meta: {
        className: 'w-[8%]',
      },
      cell: ({ row }) => {
        const isSelected = row.original.id === selectedOrderId;

        return (
          <button
            type="button"
            onClick={() => onSelectOrder(row.original)}
            className={cn(
              buttonVariants({
                variant: isSelected ? 'default' : 'ghost',
                size: 'sm',
              }),
              isSelected
                ? 'rounded-lg bg-[#ff5a00] px-3 text-white hover:bg-[#e65000]'
                : 'rounded-lg px-3 text-[#d94d00] hover:bg-orange-50 hover:text-[#c94700] dark:text-orange-300 dark:hover:bg-orange-950/20',
            )}
          >
            {isSelected ? 'Open' : 'View'}
            <ArrowRight className="h-4 w-4" />
          </button>
        );
      },
    },
  ];

  const totalPages = meta.totalPages;

  return (
    <DataTable
      columns={columns}
      data={orders}
      getRowId={(order) => order.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      density="compact"
      layout="fit"
      emptyTitle="No eligible orders"
      emptyDescription="Orders without a shipment will appear here."
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
