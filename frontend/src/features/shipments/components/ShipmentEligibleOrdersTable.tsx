'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import {
  formatCurrency,
  formatDateTime,
} from '@/features/orders/lib/order-formatters';
import type {
  OrderSummary,
  PaginationMeta,
} from '@/features/orders/types/order.types';

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
      accessorKey: 'orderNumber',
      header: 'Order',
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{row.original.orderNumber}</p>
          <p className="text-xs text-muted-foreground">
            Updated {formatDateTime(row.original.updatedAt)}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-medium text-foreground">{row.original.customerName}</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {row.original.partDescription}
          </p>
        </div>
      ),
    },
    {
      id: 'agent',
      header: 'Sales agent',
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-medium text-foreground">{row.original.createdBy.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.createdBy.email}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'totalSaleAmount',
      header: 'Total sale',
      cell: ({ row }) => (
        <span className="font-semibold text-foreground">
          {formatCurrency(row.original.totalSaleAmount)}
        </span>
      ),
    },
    {
      id: 'action',
      header: '',
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
              'px-3',
            )}
          >
            {isSelected ? 'Open' : 'Open workspace'}
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
