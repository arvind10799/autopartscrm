'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, PencilLine } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { UserRole } from '@/features/auth/types/auth.types';
import { formatCurrency } from '../lib/order-formatters';
import type { PaginationMeta, OrderSummary } from '../types/order.types';
import { ShippingStatusCell } from '@/features/shipments/components/ShippingStatusCell';

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function buildColumns(
  onEdit: (orderId: string) => void,
  role: UserRole | null | undefined,
  currentUserId?: string | null,
): ColumnDef<OrderSummary>[] {
  const columns: ColumnDef<OrderSummary>[] = [
    {
      accessorKey: 'salesNumber',
      header: 'Sale',
      meta: {
        className: 'w-[11%]',
      },
      cell: ({ row }) => (
        <div className="min-w-0 space-y-0.5">
          <Link
            href={`/orders/${row.original.id}`}
            className="block truncate font-semibold text-primary transition hover:text-primary/80"
          >
            {row.original.salesNumber ?? '—'}
          </Link>
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
        <p className="truncate font-medium text-foreground">{row.original.customerName}</p>
      ),
    },
  ];

  if (role === 'ADMIN') {
    columns.push({
      accessorKey: 'createdBy',
      header: 'Advisor',
      meta: {
        className: 'w-[8%]',
      },
      cell: ({ row }) => (
        <p className="truncate font-medium text-foreground">
          {getFirstName(row.original.createdBy.name)}
        </p>
      ),
    });
  }

  columns.push(
    {
      accessorKey: 'partDescription',
      header: 'Part',
      meta: {
        className: role === 'ADMIN' ? 'w-[28%]' : 'w-[36%]',
      },
      cell: ({ row }) => (
        <p className="truncate text-sm text-foreground" title={row.original.partDescription}>
          {row.original.partDescription}
        </p>
      ),
    },
    {
      accessorKey: 'totalSaleAmount',
      header: 'Total',
      meta: {
        className: 'w-[10%]',
      },
      cell: ({ row }) => (
        <span className="block truncate font-semibold text-foreground">
          {formatCurrency(row.original.totalSaleAmount, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'latestShipmentStatus',
      header: 'Shipping',
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
      id: 'actions',
      header: '',
      meta: {
        className: 'w-[15%]',
      },
      cell: ({ row }) => {
        const canEdit =
          role === 'ADMIN' ||
          role === 'SHIPPING' ||
          (role === 'SALES' && row.original.createdBy.id === currentUserId);

        return (
          <div className="flex items-center justify-end gap-1">
            {canEdit ? (
              <Button className="h-8 px-2" variant="outline" size="sm" onClick={() => onEdit(row.original.id)}>
                <PencilLine className="h-4 w-4" />
                <span className="hidden xl:inline">Edit</span>
              </Button>
            ) : null}
            <Link
              href={`/orders/${row.original.id}`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 px-2')}
            >
              View
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        );
      },
    },
  );

  return columns;
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
  role,
  currentUserId,
}: {
  orders: OrderSummary[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onEdit: (orderId: string) => void;
  role?: UserRole | null;
  currentUserId?: string | null;
}) {
  const totalPages = meta.totalPages;
  const columns = buildColumns(onEdit, role, currentUserId);

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
