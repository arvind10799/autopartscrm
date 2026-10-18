'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Globe2, Inbox, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/features/auth/store/auth.store';
import {
  parseTablePage,
  useTableDetailHref,
  useTableQueryParam,
} from '@/lib/filters/table-view-state';
import { cn } from '@/lib/utils/cn';
import { formatPacificDateTime } from '@/lib/utils/pacific-date';
import {
  websiteLeadsApi,
  WEBSITE_LEAD_ASSIGNMENT_FILTERS,
  WEBSITE_LEAD_STATUSES,
  type WebsiteLead,
  type WebsiteLeadAgent,
  type WebsiteLeadAssignmentFilter,
  type WebsiteLeadList,
  type WebsiteLeadStatus,
} from './website-leads-api';
import {
  WebsiteLeadAssignmentBadge,
  WebsiteLeadStatusBadge,
} from './WebsiteLeadBadges';
import { useWebsiteLeadsSummary } from './WebsiteLeadsSummaryProvider';

const PAGE_SIZE = 20;
const statusLabel: Record<WebsiteLeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  CLOSED: 'Closed',
  CONVERTED: 'Converted',
};

function requestTitle(item: WebsiteLead) {
  return (
    item.partRequested ||
    [item.vehicleYear, item.vehicleMake, item.vehicleModel]
      .filter(Boolean)
      .join(' ') ||
    'Part request'
  );
}

export function WebsiteLeadsPageContent() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const { summary } = useWebsiteLeadsSummary();
  const [search, setSearch] = useTableQueryParam('q', '', (value) => value);
  const [status, setStatus] = useTableQueryParam('status', '', (value) =>
    WEBSITE_LEAD_STATUSES.includes(value as WebsiteLeadStatus) ? value : '',
  );
  const [assignment, setAssignment] =
    useTableQueryParam<WebsiteLeadAssignmentFilter>('assignment', 'ALL', (value) =>
      WEBSITE_LEAD_ASSIGNMENT_FILTERS.includes(
        value as WebsiteLeadAssignmentFilter,
      )
        ? (value as WebsiteLeadAssignmentFilter)
        : 'ALL',
    );
  const [agent, setAgent] = useTableQueryParam('agent', '', (value) => value);
  const [page, setPage] = useTableQueryParam('page', 1, parseTablePage, false);
  const detailHref = useTableDetailHref('/website-leads');
  const deferredSearch = useDeferredValue(search);
  const [agents, setAgents] = useState<WebsiteLeadAgent[]>([]);
  const [data, setData] = useState<WebsiteLeadList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFilters = Boolean(search || status || agent || assignment !== 'ALL');

  useEffect(() => {
    if (role !== 'ADMIN') return;
    void websiteLeadsApi
      .agents()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, [role]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void websiteLeadsApi
      .list({
        page,
        limit: PAGE_SIZE,
        search: deferredSearch || undefined,
        status: status ? (status as WebsiteLeadStatus) : undefined,
        assignment: assignment !== 'ALL' ? assignment : undefined,
        assignedToId:
          role === 'ADMIN' && assignment === 'ALL' ? agent || undefined : undefined,
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to load website leads.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, deferredSearch, status, assignment, agent, role]);

  function clearFilters() {
    setSearch('');
    setStatus('');
    setAgent('');
    setAssignment('ALL');
  }

  function chooseAssignment(value: WebsiteLeadAssignmentFilter) {
    setAgent('');
    setAssignment(value);
  }

  const filters: Array<{
    value: WebsiteLeadAssignmentFilter;
    label: string;
    count: number | undefined;
  }> = [
    { value: 'ALL', label: 'All visible', count: summary?.totalCount },
    { value: 'UNASSIGNED', label: 'Unassigned', count: summary?.unassignedCount },
    { value: 'MINE', label: 'Assigned to me', count: summary?.mineCount },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ff5a00]/10 text-[#e44f00] dark:bg-orange-500/15 dark:text-orange-300">
            <Globe2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Website Leads
            </h2>
            <p className="text-sm text-muted-foreground">
              Quote and part requests received from your website.
            </p>
          </div>
        </div>
        {summary && summary.newCount > 0 ? (
          <Badge variant="warning" className="px-3 py-1.5 font-semibold">
            {summary.newCount} new {summary.newCount === 1 ? 'request' : 'requests'}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="New requests" value={summary?.newCount} tone="orange" />
        <SummaryCard label="Unassigned" value={summary?.unassignedCount} tone="blue" />
        <SummaryCard
          label={role === 'SALES' ? 'Assigned to me' : 'Total website leads'}
          value={role === 'SALES' ? summary?.mineCount : summary?.totalCount}
          tone="slate"
        />
      </div>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-border/70 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                Inquiries
              </h3>
              <p className="text-xs text-muted-foreground">
                {role === 'SALES'
                  ? 'Review unassigned requests or follow up on your own.'
                  : 'Review, assign, and convert website requests.'}
              </p>
            </div>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" /> Clear filters
              </Button>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Assignment filters">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => chooseAssignment(filter.value)}
                aria-pressed={assignment === filter.value}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
                  assignment === filter.value
                    ? 'border-[#ff5a00] bg-orange-50 text-[#c2410c] dark:bg-orange-950/40 dark:text-orange-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
                )}
              >
                {filter.label}
                {filter.count !== undefined ? (
                  <span className="rounded-full bg-slate-900/5 px-1.5 py-0.5 tabular-nums dark:bg-white/10">
                    {filter.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-[minmax(0,1fr)_180px_210px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search website leads"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer, contact, vehicle or part"
                className="pl-9"
              />
            </label>
            <Select
              aria-label="Status filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {WEBSITE_LEAD_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel[value]}
                </option>
              ))}
            </Select>
            {role === 'ADMIN' ? (
              <Select
                aria-label="Agent filter"
                value={agent}
                disabled={assignment !== 'ALL'}
                onChange={(event) => setAgent(event.target.value)}
              >
                <option value="">All agents</option>
                {agents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        </div>

        <CardContent className="p-0">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_150px_160px_140px_24px] gap-4 border-b border-border/70 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:text-slate-400 lg:grid">
            <span>Customer</span>
            <span>Request</span>
            <span>Received</span>
            <span>Assignment</span>
            <span>Status</span>
            <span className="sr-only">Open</span>
          </div>
          {error ? (
            <div className="px-5 py-10 text-center text-sm text-destructive">{error}</div>
          ) : loading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground" role="status">
              Loading website leads…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Inbox className="h-8 w-8 text-slate-400" />
              <p className="font-medium">No website leads found</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {hasFilters
                  ? 'Try another search or clear the filters to see more inquiries.'
                  : 'New quote and part requests will appear here.'}
              </p>
              {hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            data?.items.map((item) => (
              <Link
                key={item.id}
                href={detailHref(`/website-leads/${item.id}`)}
                aria-label={`Open website lead from ${item.customerName || item.customerPhone || item.customerEmail || 'unnamed customer'}`}
                className={cn(
                  'group grid gap-3 border-b border-border/70 px-4 py-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 dark:hover:bg-slate-900/70 sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_150px_160px_140px_24px] lg:items-center lg:gap-4',
                  item.status === 'NEW' && 'border-l-[3px] border-l-orange-400 bg-orange-50/40 dark:bg-orange-950/10',
                )}
              >
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-slate-950 dark:text-white">
                    {item.customerName || item.customerPhone || item.customerEmail || 'Unnamed inquiry'}
                  </strong>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.customerPhone || item.customerEmail || 'No contact number'}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{requestTitle(item)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.source === 'QUOTE' ? 'Quote request' : 'Part request'}
                    {[item.vehicleYear, item.vehicleMake, item.vehicleModel].some(Boolean)
                      ? ` · ${[item.vehicleYear, item.vehicleMake, item.vehicleModel].filter(Boolean).join(' ')}`
                      : ''}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="mr-1 lg:hidden">Received</span>
                  {formatPacificDateTime(item.submittedAt)}
                </span>
                <span>
                  <WebsiteLeadAssignmentBadge
                    name={item.assignedTo?.name || null}
                    isMine={item.assignedToId === user?.userId}
                  />
                </span>
                <span><WebsiteLeadStatusBadge status={item.status} /></span>
                <ArrowRight className="hidden h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-orange-600 lg:block" />
              </Link>
            ))
          )}

          {!loading && !error && data && data.meta.total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-muted-foreground sm:px-5">
              <span>
                {Math.min((data.meta.page - 1) * PAGE_SIZE + 1, data.meta.total)}–{Math.min(data.meta.page * PAGE_SIZE, data.meta.total)} of {data.meta.total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasPreviousPage}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <span className="hidden text-xs sm:inline">Page {data.meta.page} of {data.meta.totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasNextPage}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone: 'orange' | 'blue' | 'slate';
}) {
  const toneClass = {
    orange: 'border-orange-200 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/20',
    blue: 'border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/20',
    slate: 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50',
  }[tone];
  return (
    <div className={cn('rounded-2xl border px-4 py-3 sm:px-5', toneClass)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
        {value ?? '—'}
      </p>
    </div>
  );
}
