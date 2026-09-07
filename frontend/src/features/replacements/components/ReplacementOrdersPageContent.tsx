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
import { formatRelativeTime } from '@/features/orders/lib/order-formatters';
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
    accessorKey: 'order.salesNumber',
    header: 'Sale',
    meta: { className: 'w-[15%]' },
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/orders/${row.original.order.id}`}
          className="block truncate font-semibold text-[#d94d00] hover:text-[#ff5a00] dark:text-orange-300 dark:hover:text-orange-200"
        >
          {row.original.order.salesNumber ?? '—'}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.order.orderNumber}
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
    accessorKey: 'replacementProNumber',
    header: 'Transit',
    meta: { className: 'w-[13%]' },
    cell: ({ row }) => (
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold text-foreground">
          {row.original.replacementProNumber ?? 'PRO pending'}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.replacementCarrierName ?? 'Carrier pending'}
        </p>
      </div>
    ),
  },
  {
    id: 'actions',
    header: '',
    meta: { className: 'w-[8%]' },
    cell: ({ row }) => (
      <Link href={`/replacement-orders/${row.original.id}`}>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg border-[#ff5a00]/25 px-3 text-[#d94d00] hover:bg-orange-50 hover:text-[#c94700] dark:border-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-950/20"
        >
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
    <section className="grid gap-4">
      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950/80">
        <CardHeader className="space-y-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <CardTitle className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
              Replacement Orders
            </CardTitle>
            <div className="w-full xl:max-w-md">
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
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  startTransition(() => setPage(1));
                }}
                className="h-11 rounded-xl border-slate-200 bg-white pl-9 dark:border-slate-800 dark:bg-slate-900"
                placeholder="Search by sale, order, customer, phone, part, carrier, PRO, or yard update"
              />
            </div>

            <Select
              value={statusFilter}
              className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
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
          </div>
        </CardHeader>

        <CardContent className="p-4">
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
