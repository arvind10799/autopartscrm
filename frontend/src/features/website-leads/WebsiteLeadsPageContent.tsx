'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/store/auth.store';
import {
  parseTablePage,
  useTableDetailHref,
  useTableQueryParam,
} from '@/lib/filters/table-view-state';
import { formatPacificDateTime } from '@/lib/utils/pacific-date';
import {
  websiteLeadsApi,
  WEBSITE_LEAD_STATUSES,
  type WebsiteLeadAgent,
  type WebsiteLeadList,
  type WebsiteLeadStatus,
} from './website-leads-api';

const PAGE_SIZE = 20;
const statusLabel: Record<WebsiteLeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  CLOSED: 'Closed',
  CONVERTED: 'Converted',
};

export function WebsiteLeadsPageContent() {
  const role = useAuthStore((state) => state.user?.role);
  const [search, setSearch] = useTableQueryParam('q', '', (value) => value);
  const [status, setStatus] = useTableQueryParam('status', '', (value) =>
    WEBSITE_LEAD_STATUSES.includes(value as WebsiteLeadStatus) ? value : '',
  );
  const [agent, setAgent] = useTableQueryParam('agent', '', (value) => value);
  const [page, setPage] = useTableQueryParam('page', 1, parseTablePage, false);
  const detailHref = useTableDetailHref('/website-leads');
  const deferredSearch = useDeferredValue(search);
  const [agents, setAgents] = useState<WebsiteLeadAgent[]>([]);
  const [data, setData] = useState<WebsiteLeadList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        assignedToId: role === 'ADMIN' ? agent || undefined : undefined,
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
  }, [page, deferredSearch, status, agent, role]);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Website Leads</CardTitle>
        <p className="text-sm text-muted-foreground">
          Quote and part requests submitted on the website. Support messages are
          excluded.
        </p>
        <div className="grid gap-3 pt-2 md:grid-cols-[minmax(0,1fr)_180px_200px]">
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
      </CardHeader>
      <CardContent className="p-0">
        {error ? <p className="p-5 text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <p className="p-5 text-sm text-muted-foreground">
            Loading website leads…
          </p>
        ) : null}
        {!loading && !error && data?.items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No website leads match these filters.
          </p>
        ) : null}
        {!loading &&
          !error &&
          data?.items.map((item) => (
            <Link
              key={item.id}
              href={detailHref(`/website-leads/${item.id}`)}
              className="grid gap-2 border-b border-border/70 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-900 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_145px_125px] md:items-center"
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm">
                  {item.customerName ||
                    item.customerPhone ||
                    item.customerEmail ||
                    'Unnamed inquiry'}
                </strong>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.customerPhone ||
                    item.customerEmail ||
                    'No contact number'}
                </span>
              </span>
              <span className="truncate text-sm">
                {item.partRequested ||
                  [item.vehicleYear, item.vehicleMake, item.vehicleModel]
                    .filter(Boolean)
                    .join(' ') ||
                  'Part request'}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatPacificDateTime(item.submittedAt)}
              </span>
              <span className="text-sm font-medium">
                {statusLabel[item.status]}
                {role === 'ADMIN' && item.assignedTo
                  ? ` · ${item.assignedTo.name}`
                  : ''}
              </span>
            </Link>
          ))}
        {data ? (
          <div className="flex items-center justify-between gap-3 p-4 text-sm text-muted-foreground">
            <span>
              {data.meta.total} website leads · Page {data.meta.page} of{' '}
              {Math.max(1, data.meta.totalPages)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.meta.hasPreviousPage || loading}
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.meta.hasNextPage || loading}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
