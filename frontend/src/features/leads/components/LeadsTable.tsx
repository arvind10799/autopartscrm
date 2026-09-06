'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  RefreshCw,
} from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import type { UserRole } from '@/features/auth/types/auth.types';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatLeadCurrency } from '../lib/lead-formatters';
import { formatLeadStatusLabel } from '../lib/leads.helpers';
import type { LeadStatus, LeadSummary, PaginationMeta } from '../types/lead.types';

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function formatVehicleSummary(lead: LeadSummary) {
  return [lead.vehicleYear, lead.vehicleMake, lead.vehicleModel]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ') || '--';
}

function getLeadStatusTone(status: LeadStatus | 'CONVERTED') {
  const toneClasses: Record<LeadStatus | 'CONVERTED', string> = {
    CONVERTED:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
    PROSPECT:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300',
    QUOTED:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300',
    CALL_BACK_LATER:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
    SHOPPING_AROUND:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300',
    NOT_INTERESTED:
      'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
    NEEDS_LOCALLY:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
    WE_DONT_SALE:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
  };

  return toneClasses[status];
}

function buildColumns(
  onConvert: (lead: LeadSummary) => void,
  onEdit: (lead: LeadSummary) => void,
  role?: UserRole,
): ColumnDef<LeadSummary>[] {
  const columns: ColumnDef<LeadSummary>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
      meta: {
        className: 'w-[12%] overflow-hidden',
      },
      cell: ({ row }) => (
        <p className="truncate font-semibold text-slate-950 dark:text-white" title={formatDate(row.original.date)}>
          {formatDate(row.original.date)}
        </p>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      meta: {
        className: role === 'ADMIN' ? 'w-[15%] overflow-hidden' : 'w-[18%] overflow-hidden',
      },
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-950 dark:text-white">
            {row.original.customerName}
          </p>
          {row.original.customerEmail ? (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {row.original.customerEmail}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'customerPhone',
      header: 'Phone No.',
      meta: {
        className: 'w-[14%] overflow-hidden',
      },
      cell: ({ row }) => (
        <p
          className="truncate text-sm font-medium text-slate-700 dark:text-slate-200"
          title={row.original.customerPhone}
        >
          {row.original.customerPhone}
        </p>
      ),
    },
    {
      accessorKey: 'partDescription',
      header: 'Vehicle',
      meta: {
        className: role === 'ADMIN' ? 'w-[22%] overflow-hidden' : 'w-[28%] overflow-hidden',
      },
      cell: ({ row }) => (
        <p className="truncate text-sm text-slate-700 dark:text-slate-200" title={formatVehicleSummary(row.original)}>
          {formatVehicleSummary(row.original)}
        </p>
      ),
    },
    {
      accessorKey: 'quote',
      header: 'Quote',
      meta: {
        className: 'w-[11%] overflow-hidden text-right',
      },
      cell: ({ row }) => (
        <span className="block truncate font-semibold text-slate-950 dark:text-white">
          {row.original.quote !== null
            ? formatLeadCurrency(row.original.quote, row.original.quoteCurrency)
            : '--'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      meta: {
        className: role === 'ADMIN' ? 'w-[11%] overflow-hidden' : 'w-[10%] overflow-hidden',
      },
      cell: ({ row }) => {
        const status = row.original.isConverted ? 'CONVERTED' : row.original.status;

        return (
          <Badge
            variant="outline"
            className={cn(
              'inline-flex max-w-full justify-center rounded-full px-2.5 py-1 text-center text-xs font-semibold leading-tight',
              status === 'CALL_BACK_LATER'
                ? 'whitespace-normal rounded-2xl'
                : 'whitespace-nowrap',
              getLeadStatusTone(status),
            )}
          >
            {status === 'CONVERTED' ? 'Converted' : formatLeadStatusLabel(status)}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      meta: {
        className: 'w-[7%] text-right',
      },
      cell: ({ row }) =>
        row.original.isConverted && row.original.convertedOrder ? (
          <Link
            href={`/orders/${row.original.convertedOrder.id}`}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'h-8 rounded-xl px-2 text-xs text-[#0f6fb7] hover:bg-sky-50 hover:text-[#0b5f9e] dark:text-sky-300 dark:hover:bg-sky-950/30',
            )}
            title="View order"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="sr-only">View order</span>
          </Link>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl px-2 text-xs"
              onClick={() => onEdit(row.original)}
              title="Edit"
            >
              <PencilLine className="h-4 w-4" />
              <span className="hidden xl:inline">Edit</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl border-[#ff5a00]/25 px-2 text-xs text-[#d94d00] hover:bg-orange-50 hover:text-[#c94700] dark:border-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-950/20"
              onClick={() => onConvert(row.original)}
              title="Convert to order"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden 2xl:inline">Convert</span>
            </Button>
          </div>
        ),
    },
  ];

  if (role === 'ADMIN') {
    columns.splice(2, 0, {
      accessorKey: 'adviserName',
      header: 'Adviser',
      meta: {
        className: 'w-[8%] overflow-hidden',
      },
      cell: ({ row }) => (
        <p className="truncate font-medium text-slate-700 dark:text-slate-200" title={row.original.adviserName}>
          {getFirstName(row.original.adviserName)}
        </p>
      ),
    });
  }

  return columns;
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
  onEdit,
  role,
}: {
  leads: LeadSummary[];
  meta: PaginationMeta;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onConvert: (lead: LeadSummary) => void;
  onEdit: (lead: LeadSummary) => void;
  role?: UserRole;
}) {
  const totalPages = meta.totalPages;
  const columns = buildColumns(onConvert, onEdit, role);

  return (
    <DataTable
      columns={columns}
      data={leads}
      getRowId={(lead) => lead.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      density="compact"
      layout="fit"
      emptyTitle="No leads found"
      emptyDescription="Create a new lead or clear the current search and conversion filters."
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {getRangeLabel(meta, leads.length)}
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

            <span className="min-w-24 text-center text-sm text-slate-500 dark:text-slate-400">
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
