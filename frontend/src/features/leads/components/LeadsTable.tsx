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

function formatUpdatedAge(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return '';
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000),
  );

  if (elapsedSeconds < 60) {
    return 'just now';
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} ${elapsedHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 30) {
    return `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);

  if (elapsedMonths < 12) {
    return `${elapsedMonths} ${elapsedMonths === 1 ? 'month' : 'months'} ago`;
  }

  const elapsedYears = Math.floor(elapsedMonths / 12);
  return `${elapsedYears} ${elapsedYears === 1 ? 'year' : 'years'} ago`;
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
  currentUserId?: string | null,
  showAgentColumn = false,
): ColumnDef<LeadSummary>[] {
  const columns: ColumnDef<LeadSummary>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
      meta: {
        className: role === 'ADMIN' ? 'w-[10%] overflow-hidden px-2' : 'w-[11%] overflow-hidden px-2',
      },
      cell: ({ row }) => (
        <div className="min-w-0">
          <p
            className="truncate font-semibold text-slate-950 dark:text-white"
            title={formatDate(row.original.date)}
          >
            {formatDate(row.original.date)}
          </p>
          <p
            className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400"
            title={`Updated ${formatUpdatedAge(row.original.updatedAt)}`}
          >
            Updated {formatUpdatedAge(row.original.updatedAt)}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      meta: {
        className: role === 'ADMIN' ? 'w-[15%] overflow-hidden px-2' : 'w-[18%] overflow-hidden px-2',
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
        className: role === 'ADMIN' ? 'w-[13%] overflow-hidden px-2' : 'w-[14%] overflow-hidden px-2',
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
        className: role === 'ADMIN' ? 'w-[24%] overflow-hidden px-2' : 'w-[27%] overflow-hidden px-2',
      },
      cell: ({ row }) => (
        <p
          className="truncate text-sm text-slate-700 dark:text-slate-200"
          title={formatVehicleSummary(row.original)}
        >
          {formatVehicleSummary(row.original)}
        </p>
      ),
    },
    {
      accessorKey: 'quote',
      header: 'Quote',
      meta: {
        className: 'w-[10%] overflow-hidden px-2 text-right',
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
        className: 'w-[12%] overflow-hidden px-2',
      },
      cell: ({ row }) => {
        const status = row.original.isConverted ? 'CONVERTED' : row.original.status;

        return (
          <Badge
            variant="outline"
            title={status === 'CONVERTED' ? 'Converted' : formatLeadStatusLabel(status)}
            className={cn(
              'inline-flex max-w-full truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-tight',
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
        className: 'w-[8%] overflow-hidden px-2 text-right',
      },
      cell: ({ row }) => {
        const canManageLead =
          role === 'ADMIN' ||
          (role === 'SALES' && row.original.createdBy.id === currentUserId);

        if (row.original.isConverted && row.original.convertedOrder) {
          return (
          <Link
            href={`/orders/${row.original.convertedOrder.id}`}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'h-8 w-8 rounded-xl px-0 text-xs text-[#0f6fb7] hover:bg-sky-50 hover:text-[#0b5f9e] dark:text-sky-300 dark:hover:bg-sky-950/30',
            )}
            title="View order"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="sr-only">View order</span>
          </Link>
          );
        }

        if (!canManageLead) {
          return (
            <Link
              href={`/leads/${row.original.id}`}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'h-8 w-8 rounded-xl px-0 text-xs text-[#0f6fb7] hover:bg-sky-50 hover:text-[#0b5f9e] dark:text-sky-300 dark:hover:bg-sky-950/30',
              )}
              title="View lead"
            >
              <ArrowRight className="h-4 w-4" />
              <span className="sr-only">View lead</span>
            </Link>
          );
        }

        return (
          <div className="flex min-w-0 items-center justify-end gap-1">
            <Link
              href={`/leads/${row.original.id}`}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'h-8 w-8 rounded-xl px-0 text-xs text-[#0f6fb7] hover:bg-sky-50 hover:text-[#0b5f9e] dark:text-sky-300 dark:hover:bg-sky-950/30',
              )}
              title="View lead"
            >
              <ArrowRight className="h-4 w-4" />
              <span className="sr-only">View lead</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-xl px-0 text-xs"
              onClick={() => onEdit(row.original)}
              title="Edit"
            >
              <PencilLine className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 rounded-xl border-[#ff5a00]/25 px-0 text-xs text-[#d94d00] hover:bg-orange-50 hover:text-[#c94700] dark:border-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-950/20"
              onClick={() => onConvert(row.original)}
              title="Convert to order"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Convert to order</span>
            </Button>
          </div>
        );
      },
    },
  ];

  if (showAgentColumn) {
    columns.splice(2, 0, {
      accessorKey: 'createdBy.name',
      header: 'Agent',
      meta: {
        className: 'hidden w-[8%] overflow-hidden px-2 2xl:table-cell',
      },
      cell: ({ row }) => (
        <p
          className="truncate font-medium text-slate-700 dark:text-slate-200"
          title={row.original.createdBy.name}
        >
          {getFirstName(row.original.createdBy.name)}
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
  currentUserId,
  showAgentColumn = false,
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
  currentUserId?: string | null;
  showAgentColumn?: boolean;
}) {
  const totalPages = meta.totalPages;
  const columns = buildColumns(
    onConvert,
    onEdit,
    role,
    currentUserId,
    showAgentColumn,
  );

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
      renderMobileCard={(lead) => {
        const status = lead.isConverted ? 'CONVERTED' : lead.status;
        const canManageLead =
          role === 'ADMIN' ||
          (role === 'SALES' && lead.createdBy.id === currentUserId);

        return (
          <article className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {lead.customerName}
                </p>
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {formatDate(lead.date)}
                </p>
                <p className="truncate text-[11px] font-medium text-muted-foreground">
                  Updated {formatUpdatedAge(lead.updatedAt)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
                  getLeadStatusTone(status),
                )}
              >
                {status === 'CONVERTED' ? 'Converted' : formatLeadStatusLabel(status)}
              </Badge>
            </div>

            <div className="mt-3 grid gap-2 text-sm">
              {showAgentColumn ? (
                <MobileField label="Agent" value={getFirstName(lead.createdBy.name)} />
              ) : null}
              <MobileField label="Phone" value={lead.customerPhone} />
              <MobileField label="Vehicle" value={formatVehicleSummary(lead)} />
              <MobileField
                label="Quote"
                value={
                  lead.quote !== null
                    ? formatLeadCurrency(lead.quote, lead.quoteCurrency)
                    : '—'
                }
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {lead.isConverted && lead.convertedOrder ? (
                <Link
                  href={`/orders/${lead.convertedOrder.id}`}
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'sm' }),
                    'col-span-2 h-9 rounded-xl bg-[#ff5a00] text-white hover:bg-[#e65000]',
                  )}
                >
                  View order
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href={`/leads/${lead.id}`}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      canManageLead ? 'h-9 rounded-xl' : 'col-span-2 h-9 rounded-xl',
                    )}
                  >
                    View lead
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {canManageLead ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl"
                        onClick={() => onEdit(lead)}
                      >
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-9 rounded-xl bg-[#ff5a00] text-white hover:bg-[#e65000]"
                        onClick={() => onConvert(lead)}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Convert
                      </Button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </article>
        );
      }}
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
