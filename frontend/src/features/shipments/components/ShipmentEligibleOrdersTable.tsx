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
      renderMobileCard={(order) => {
        const isSelected = order.id === selectedOrderId;

        return (
          <article
            className={cn(
              'rounded-2xl border bg-card p-3 shadow-sm',
              isSelected
                ? 'border-[#ff5a00]/50 ring-2 ring-orange-100 dark:ring-orange-950/30'
                : 'border-border/70',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[#d94d00] dark:text-orange-300">
                  {order.salesNumber ?? '—'}
                </p>
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {order.orderNumber}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-sm font-semibold text-[#d94d00] dark:bg-orange-950/25 dark:text-orange-300">
                {formatCurrency(order.totalSaleAmount, order.currency)}
              </span>
            </div>

            <div className="mt-3 grid gap-2 text-sm">
              <MobileField label="Customer" value={order.customerName} />
              <MobileField label="Advisor" value={getFirstName(order.createdBy.name)} />
              <MobileField label="Part" value={order.partDescription} />
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Status
                </span>
                <ShippingStatusCell
                  status={order.latestShipmentStatus}
                  orderStatus={order.status}
                  orderDate={order.intakeDetails?.orderDate}
                  fallbackDate={order.createdAt}
                  bolNumber={order.latestShipment?.bolNumber}
                  proNumber={order.latestShipment?.proNumber}
                  hasReplacement={order.counts.replacementRequests > 0}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectOrder(order)}
              className={cn(
                buttonVariants({
                  variant: isSelected ? 'default' : 'outline',
                  size: 'sm',
                }),
                'mt-3 h-9 w-full rounded-xl',
                isSelected
                  ? 'bg-[#ff5a00] text-white hover:bg-[#e65000]'
                  : 'border-[#ff5a00]/25 text-[#d94d00] hover:bg-orange-50 hover:text-[#c94700] dark:border-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-950/20',
              )}
            >
              {isSelected ? 'Selected' : 'View'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </article>
        );
      }}
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
