'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Search, ArrowUpRight } from 'lucide-react';
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import { TablePagination } from '@/components/data-table/TablePagination';
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
  type DateRangeFilterState,
} from '@/lib/filters/date-range';
import { parseTablePage, useTableDateRange, useTableDetailHref, useTableQueryParam } from '@/lib/filters/table-view-state';
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

const buildColumns = (detailHref: (path: string) => string): ColumnDef<ReplacementRequest>[] => [
  {
    accessorKey: 'order.salesNumber',
    header: 'Sale',
    meta: { className: 'w-[112px]' },
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={detailHref(`/orders/${row.original.order.id}`)}
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
    meta: { className: 'w-[128px]' },
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
    meta: { className: '' },
    cell: ({ row }) => (
      <p className="line-clamp-2 text-sm text-foreground">
        {row.original.order.partDescription}
      </p>
    ),
  },
  {
    accessorKey: 'replacementStatus',
    header: 'Status',
    meta: { className: 'w-[144px]' },
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
    meta: { className: 'w-[176px]' },
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
    meta: { className: 'w-[120px]' },
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
    header: 'Actions',
    meta: { className: 'w-[96px]', sticky: 'right' },
    cell: ({ row }) => (
      <Link href={detailHref(`/replacement-orders/${row.original.id}`)}>
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
  const [searchTerm, setSearchTerm] = useTableQueryParam('q', '', (value) => value);
  const [statusFilter, setStatusFilter] =
    useTableQueryParam<ReplacementStatusFilter>('status', ALL_REPLACEMENT_STATUS_FILTER, parseReplacementStatusFilter);
  const [dateFilter, setDateFilter] = useTableDateRange();
  const [page, setPage] = useTableQueryParam('page', 1, parseTablePage, false);
  const detailHref = useTableDetailHref('/replacement-orders');
  const columns = buildColumns(detailHref);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeSearch = deferredSearchTerm.trim();
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter, refreshKey],
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
        <CardHeader className="crm-records-toolbar space-y-3 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <CardTitle className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
              Replacement Orders
            </CardTitle>
          </div>

          <div
            className="crm-toolbar-controls"
          >
            <div className="crm-toolbar-search">
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
              className="crm-toolbar-status h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
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

            <div
              className="crm-date-control" data-custom={dateFilter.preset === "CUSTOM"}
            >
              <DateRangeFilter
                value={dateFilter}
                onChange={(value) => {
                  setDateFilter(value);
                  startTransition(() => setPage(1));
                }}
                variant="inline"
                showPresetLabel={false}
                inlineCustomLayout="row"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4">
          <DataTable
            columns={columns}
            data={replacementsResponse.items}
            isLoading={isLoading}
            error={error}
            onRetry={() => setRefreshKey((currentValue) => currentValue + 1)}
            emptyTitle="No replacement orders"
            emptyDescription="Replacement requests created from orders or shipments will appear here."
            density="compact"
            layout="scroll"
            tableLabel="Replacement orders"
            renderMobileCard={(replacement) => (
              <article className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={detailHref(`/replacement-orders/${replacement.id}`)}
                      className="block truncate text-base font-semibold text-[#d94d00] dark:text-orange-300"
                    >
                      {replacement.order.salesNumber ?? '—'}
                    </Link>
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {replacement.order.orderNumber}
                    </p>
                  </div>
                  <ReplacementStatusBadge status={replacement.replacementStatus} />
                </div>

                <div className="mt-3 grid gap-2 text-sm">
                  <MobileField label="Customer" value={replacement.order.customerName} />
                  <MobileField label="Phone" value={replacement.order.customerPhone ?? 'No phone'} />
                  <MobileField label="Part" value={replacement.order.partDescription} />
                  <MobileField label="Reason" value={replacement.customerReason} />
                  <MobileField label="Yard" value={replacement.yardUpdate ?? 'No yard update yet'} />
                  <MobileField label="Carrier" value={replacement.replacementCarrierName ?? 'Carrier pending'} />
                  <MobileField label="PRO" value={replacement.replacementProNumber ?? 'PRO pending'} />
                  <MobileField label="Updated" value={formatRelativeTime(replacement.updatedAt)} />
                </div>

                <Link href={detailHref(`/replacement-orders/${replacement.id}`)}>
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-3 h-9 w-full rounded-xl bg-[#ff5a00] text-white hover:bg-[#e65000]"
                  >
                    Open replacement
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              </article>
            )}
            footer={<TablePagination meta={replacementsResponse.meta} summary={`${replacementsResponse.meta.total} replacement orders`} onPageChange={setPage} disabled={isLoading} />}
          />
        </CardContent>
      </Card>
    </section>
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
