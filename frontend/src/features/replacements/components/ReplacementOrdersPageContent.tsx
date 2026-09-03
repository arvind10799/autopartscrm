'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Search, ArrowUpRight } from 'lucide-react';
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  buildTimestampRangeQuery,
  createDefaultDateRangeFilterState,
  type DateRangeFilterState,
} from '@/lib/filters/date-range';
import { formatDateTime, formatRelativeTime } from '@/features/orders/lib/order-formatters';
import { formatShipmentStatusOptionLabel } from '@/features/shipments/lib/shipments.helpers';
import { useReplacementsList } from '../hooks/useReplacementsList';
import {
  ALL_REPLACEMENT_STATUS_FILTER,
  formatReplacementStatus,
  parseReplacementStatusFilter,
  type ReplacementStatusFilter,
} from '../lib/replacements.helpers';
import { REPLACEMENT_STATUSES, type ReplacementRequest } from '../types/replacement.types';
import { ReplacementStatusBadge } from './ReplacementStatusBadge';

const columns: ColumnDef<ReplacementRequest>[] = [
  {
    accessorKey: 'order.orderNumber',
    header: 'Order',
    meta: { className: 'w-[15%]' },
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/orders/${row.original.order.id}`}
          className="block truncate font-semibold text-primary hover:text-primary/80"
        >
          {row.original.order.orderNumber}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          Sale {row.original.order.salesNumber ?? '—'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'order.customerName',
    header: 'Customer',
    meta: { className: 'w-[16%]' },
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">
          {row.original.order.customerName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.order.customerPhone ?? 'No phone'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'order.partDescription',
    header: 'Part',
    meta: { className: 'w-[18%]' },
    cell: ({ row }) => (
      <p className="line-clamp-2 text-sm text-foreground">
        {row.original.order.partDescription}
      </p>
    ),
  },
  {
    accessorKey: 'replacementStatus',
    header: 'Status',
    meta: { className: 'w-[15%]' },
    cell: ({ row }) => (
      <div className="space-y-1">
        <ReplacementStatusBadge status={row.original.replacementStatus} />
        <p className="text-xs text-muted-foreground">
          {formatRelativeTime(row.original.updatedAt)}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'customerReason',
    header: 'Reason / Yard',
    meta: { className: 'w-[24%]' },
    cell: ({ row }) => (
      <div className="space-y-1 text-sm">
        <p className="line-clamp-1 font-medium text-foreground">
          {row.original.customerReason}
        </p>
        <p className="line-clamp-1 text-muted-foreground">
          {row.original.yardUpdate ?? 'No yard update yet'}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'shipment',
    header: 'Shipment',
    meta: { className: 'w-[13%]' },
    cell: ({ row }) =>
      row.original.shipment ? (
        <div className="min-w-0 text-sm">
          <Link
            href={`/shipments/${row.original.shipment.id}`}
            className="block truncate font-semibold text-primary hover:text-primary/80"
          >
            {row.original.shipment.bolNumber ?? 'BOL pending'}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {formatShipmentStatusOptionLabel(row.original.shipment.status)}
          </p>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Not linked</span>
      ),
  },
  {
    id: 'actions',
    header: '',
    meta: { className: 'w-[8%]' },
    cell: ({ row }) => (
      <Link href={`/replacement-orders/${row.original.id}`}>
        <Button variant="outline" size="sm">
          Open
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </Link>
    ),
  },
];

export function ReplacementOrdersPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<ReplacementStatusFilter>(ALL_REPLACEMENT_STATUS_FILTER);
  const [dateFilter, setDateFilter] = useState(
    createDefaultDateRangeFilterState(),
  );
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeSearch = deferredSearchTerm.trim();
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter],
  );
  const { replacementsResponse, isLoading, error } = useReplacementsList({
    page,
    search: activeSearch,
    status: statusFilter,
    createdFrom: dateRangeQuery.createdFrom,
    createdTo: dateRangeQuery.createdTo,
    refreshKey,
  });
  const { totalPages } = replacementsResponse.meta;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (totalPages === 0 && page !== 1) {
      startTransition(() => setPage(1));
      return;
    }

    if (totalPages > 0 && page > totalPages) {
      startTransition(() => setPage(totalPages));
    }
  }, [isLoading, page, totalPages]);

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="space-y-2">
            <CardTitle className="text-2xl sm:text-[1.75rem]">
              Replacement Orders
            </CardTitle>
            <CardDescription>
              Track replacement requests, customer reasons, yard updates, and status history.
            </CardDescription>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_230px_minmax(22rem,28rem)] xl:items-start">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  startTransition(() => setPage(1));
                }}
                className="pl-9"
                placeholder="Search by order, customer, phone, part, BOL, PRO, or yard update"
              />
            </div>

            <Select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(parseReplacementStatusFilter(event.target.value));
                startTransition(() => setPage(1));
              }}
            >
              <option value={ALL_REPLACEMENT_STATUS_FILTER}>All replacement statuses</option>
              {REPLACEMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatReplacementStatus(status)}
                </option>
              ))}
            </Select>

            <DateRangeFilter
              value={dateFilter}
              onChange={(value) => {
                setDateFilter(value);
                startTransition(() => setPage(1));
              }}
              variant="inline"
              showPresetLabel={false}
            />
          </div>
        </CardHeader>

        <CardContent>
          <DataTable
            columns={columns}
            data={replacementsResponse.items}
            isLoading={isLoading}
            error={error}
            onRetry={() => setRefreshKey((currentValue) => currentValue + 1)}
            emptyTitle="No replacement orders"
            emptyDescription="Replacement requests created from orders or shipments will appear here."
            density="compact"
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  Showing page {replacementsResponse.meta.page} of{' '}
                  {Math.max(replacementsResponse.meta.totalPages, 1)} ·{' '}
                  {replacementsResponse.meta.total} replacement orders
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!replacementsResponse.meta.hasPreviousPage}
                    onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!replacementsResponse.meta.hasNextPage}
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>
    </section>
  );
}
