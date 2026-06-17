'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatDate, formatDateTime } from '../lib/lead-formatters';
import type { LeadSummary, PaginationMeta } from '../types/lead.types';

function buildColumns(
  onConvert: (lead: LeadSummary) => void,
): ColumnDef<LeadSummary>[] {
  return [
    {
      accessorKey: 'date',
      header: 'Lead date',
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{formatDate(row.original.date)}</p>
          <p className="text-xs text-muted-foreground">
            Saved {formatDateTime(row.original.createdAt)}
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
          <p className="text-xs text-muted-foreground">{row.original.customerPhone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'adviserName',
      header: 'Adviser',
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-medium text-foreground">{row.original.adviserName}</p>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {row.original.cmpt}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'partDescription',
      header: 'Part',
      cell: ({ row }) => (
        <p className="max-w-xs text-sm text-foreground">{row.original.partDescription}</p>
      ),
    },
    {
      accessorKey: 'quote',
      header: 'Quote',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.quote !== null ? formatCurrency(row.original.quote) : '--'}
        </span>
      ),
    },
    {
      accessorKey: 'prospects',
      header: 'Prospects',
      cell: ({ row }) => (
        <p className="max-w-[14rem] text-sm text-foreground">{row.original.prospects}</p>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.isConverted ? (
          <div className="space-y-1">
            <p className="font-medium text-foreground">Converted</p>
            <p className="text-xs text-muted-foreground">
              {row.original.convertedOrder?.orderNumber ?? 'Order linked'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="font-medium text-foreground">Open</p>
            <p className="text-xs text-muted-foreground">Ready for order conversion</p>
          </div>
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.isConverted && row.original.convertedOrder ? (
          <Link
            href={`/orders/${row.original.convertedOrder.id}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'px-2')}
          >
            View order
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Button variant="outline" size="sm" onClick={() => onConvert(row.original)}>
            <RefreshCw className="h-4 w-4" />
            Convert to order
          </Button>
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

  return `${start}-${end} of ${meta.total} leads`;
}

export function LeadsTable({
  leads,
  meta,
  isLoading,
  error,
  onRetry,
  onPageChange,
  onConvert,
}: {
  leads: LeadSummary[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onConvert: (lead: LeadSummary) => void;
}) {
  const totalPages = meta.totalPages;
  const columns = buildColumns(onConvert);

  return (
    <DataTable
      columns={columns}
      data={leads}
      getRowId={(lead) => lead.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No leads found"
      emptyDescription="Create a new lead or clear the current search and conversion filters."
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{getRangeLabel(meta, leads.length)}</p>

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
