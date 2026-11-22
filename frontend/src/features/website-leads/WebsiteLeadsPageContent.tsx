"use client";
import { FollowUpCell } from "@/features/reminders/FollowUpCell";
import { TablePagination } from "@/components/data-table/TablePagination";
import { TableScrollArea } from "@/components/data-table/TableScrollArea";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Globe2, Inbox, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  parseTablePage,
  useTableDateRange,
  useTableDetailHref,
  useTableQueryParam,
} from "@/lib/filters/table-view-state";
import { cn } from "@/lib/utils/cn";
import { formatPacificDateTime } from "@/lib/utils/pacific-date";
import {
  websiteLeadsApi,
  WEBSITE_LEAD_ASSIGNMENT_FILTERS,
  WEBSITE_LEAD_STATUSES,
  type WebsiteLead,
  type WebsiteLeadAgent,
  type WebsiteLeadAssignmentFilter,
  type WebsiteLeadList,
  type WebsiteLeadStatus,
} from "./website-leads-api";
import {
  WebsiteLeadAssignmentBadge,
  WebsiteLeadStatusBadge,
} from "./WebsiteLeadBadges";
import { useWebsiteLeadsSummary } from "./WebsiteLeadsSummaryProvider";
import { buildWebsiteLeadSubmittedRangeQuery } from "./website-lead-date-range";

const PAGE_SIZE = 20;
const statusLabel: Record<WebsiteLeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CLOSED: "Closed",
  CONVERTED: "Converted",
};

function requestTitle(item: WebsiteLead) {
  return (
    item.partRequested ||
    [item.vehicleYear, item.vehicleMake, item.vehicleModel]
      .filter(Boolean)
      .join(" ") ||
    "Part request"
  );
}

export function WebsiteLeadsPageContent() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const { summary } = useWebsiteLeadsSummary();
  const [noUpcoming, setNoUpcoming] = useTableQueryParam(
    "noUpcoming",
    "",
    (v) => (v === "true" ? "true" : ""),
  );
  const [search, setSearch] = useTableQueryParam("q", "", (value) => value);
  const [status, setStatus] = useTableQueryParam("status", "", (value) =>
    WEBSITE_LEAD_STATUSES.includes(value as WebsiteLeadStatus) ? value : "",
  );
  const [assignment, setAssignment] =
    useTableQueryParam<WebsiteLeadAssignmentFilter>(
      "assignment",
      "ALL",
      (value) =>
        WEBSITE_LEAD_ASSIGNMENT_FILTERS.includes(
          value as WebsiteLeadAssignmentFilter,
        )
          ? (value as WebsiteLeadAssignmentFilter)
          : "ALL",
    );
  const [agent, setAgent] = useTableQueryParam("agent", "", (value) => value);
  const [dateFilter, setDateFilter] = useTableDateRange();
  const [page, setPage] = useTableQueryParam("page", 1, parseTablePage, false);
  const detailHref = useTableDetailHref("/website-leads");
  const deferredSearch = useDeferredValue(search);
  const [agents, setAgents] = useState<WebsiteLeadAgent[]>([]);
  const [data, setData] = useState<WebsiteLeadList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFilters = Boolean(
    noUpcoming ||
    search ||
    status ||
    agent ||
    assignment !== "ALL" ||
    dateFilter.preset !== "ALL",
  );
  const { createdFrom, createdTo } = useMemo(
    () => buildWebsiteLeadSubmittedRangeQuery(dateFilter),
    [dateFilter.preset, dateFilter.from, dateFilter.to],
  );

  useEffect(() => {
    if (role !== "ADMIN") return;
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
        noUpcoming: noUpcoming === "true" || undefined,
        search: deferredSearch || undefined,
        status: status ? (status as WebsiteLeadStatus) : undefined,
        createdFrom,
        createdTo,
        assignment: assignment !== "ALL" ? assignment : undefined,
        assignedToId:
          role === "ADMIN" && assignment === "ALL"
            ? agent || undefined
            : undefined,
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load website leads.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    noUpcoming,
    page,
    deferredSearch,
    status,
    assignment,
    agent,
    role,
    createdFrom,
    createdTo,
  ]);

  function clearFilters() {
    setNoUpcoming("");
    setSearch("");
    setStatus("");
    setAgent("");
    setAssignment("ALL");
    setDateFilter({ preset: "ALL", from: "", to: "" });
  }

  function chooseAssignment(value: WebsiteLeadAssignmentFilter) {
    setAgent("");
    setAssignment(value);
  }

  const filters: Array<{
    value: WebsiteLeadAssignmentFilter;
    label: string;
    count: number | undefined;
  }> = [
    { value: "ALL", label: "All visible", count: summary?.totalCount },
    {
      value: "UNASSIGNED",
      label: "Unassigned",
      count: summary?.unassignedCount,
    },
    { value: "MINE", label: "Assigned to me", count: summary?.mineCount },
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
            {summary.newCount} new{" "}
            {summary.newCount === 1 ? "request" : "requests"}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="New requests"
          value={summary?.newCount}
          tone="orange"
        />
        <SummaryCard
          label="Unassigned"
          value={summary?.unassignedCount}
          tone="blue"
        />
        <SummaryCard
          label={role === "SALES" ? "Assigned to me" : "Total website leads"}
          value={role === "SALES" ? summary?.mineCount : summary?.totalCount}
          tone="slate"
        />
      </div>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="crm-records-toolbar border-b border-border/70 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                Inquiries
              </h3>
              <p className="text-xs text-muted-foreground">
                {role === "SALES"
                  ? "Review unassigned requests or follow up on your own."
                  : "Review, assign, and convert website requests."}
              </p>
            </div>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" /> Clear filters
              </Button>
            ) : null}
          </div>
          <div
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Assignment filters"
          >
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => chooseAssignment(filter.value)}
                aria-pressed={assignment === filter.value}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                  assignment === filter.value
                    ? "border-[#ff5a00] bg-orange-50 text-[#c2410c] dark:bg-orange-950/40 dark:text-orange-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
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
          <div
            className="crm-filters mt-4"
          >
            <label className="crm-record-search">
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
            <Select
              aria-label="Upcoming reminder filter"
              value={noUpcoming}
              onChange={(e) =>
                setNoUpcoming(e.target.value === "true" ? "true" : "")
              }
            >
              <option value="">All follow-ups</option>
              <option value="true">No upcoming reminder</option>
            </Select>
            <div
              className={cn(dateFilter.preset === "CUSTOM" && "crm-wide-filter")}
            >
              <DateRangeFilter
                value={dateFilter}
                onChange={setDateFilter}
                variant="inline"
                showPresetLabel={false}
                inlineCustomLayout="row"
                showDayPresets
                dateLabel="Received"
                compactControls
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Received date · Pacific time
              </p>
            </div>
            {role === "ADMIN" ? (
              <Select
                aria-label="Agent filter"
                value={agent}
                disabled={assignment !== "ALL"}
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

        <CardContent className="crm-website-records p-0">
          <TableScrollArea label="Website leads">
          <div className="crm-website-header border-b border-border/70 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <span>Customer</span>
            <span>Request</span>
            <span>Received</span>
            <span>Assignment</span>
            <span>Next follow-up</span>
            <span>Status</span>
            <span className="sr-only">Open</span>
          </div>
          <div className="crm-website-body">
          {error ? (
            <div className="px-5 py-10 text-center text-sm text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div
              className="px-5 py-10 text-center text-sm text-muted-foreground"
              role="status"
            >
              Loading website leads…
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Inbox className="h-8 w-8 text-slate-400" />
              <p className="font-medium">No website leads found</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {hasFilters
                  ? "Try another search or clear the filters to see more inquiries."
                  : "New quote and part requests will appear here."}
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
                aria-label={`Open website lead from ${item.customerName || item.customerPhone || item.customerEmail || "unnamed customer"}`}
                className={cn(
                  "crm-website-row group transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 dark:hover:bg-slate-900/70",
                  item.status === "NEW" &&
                    "border-l-[3px] border-l-orange-400 bg-orange-50/40 dark:bg-orange-950/10",
                )}
              >
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-slate-950 dark:text-white">
                    {item.customerName ||
                      item.customerPhone ||
                      item.customerEmail ||
                      "Unnamed inquiry"}
                  </strong>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.customerPhone ||
                      item.customerEmail ||
                      "No contact number"}
                  </span>
                  {item.customerPhone && item.customerEmail && (
                    <span className="block truncate text-xs text-muted-foreground">{item.customerEmail}</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="crm-website-label">Request</span>
                  <span className="block truncate text-sm font-medium">
                    {requestTitle(item)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.source === "QUOTE" ? "Quote request" : "Part request"}
                    {[
                      item.vehicleYear,
                      item.vehicleMake,
                      item.vehicleModel,
                    ].some(Boolean)
                      ? ` · ${[item.vehicleYear, item.vehicleMake, item.vehicleModel].filter(Boolean).join(" ")}`
                      : ""}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="crm-website-label">Received</span>
                  {formatPacificDateTime(item.submittedAt)}
                </span>
                <span>
                  <span className="crm-website-label">Assignment</span>
                  <WebsiteLeadAssignmentBadge
                    name={item.assignedTo?.name || null}
                    isMine={item.assignedToId === user?.userId}
                  />
                </span>
                <span>
                  <span className="crm-website-label">
                    Next follow-up
                  </span>
                  <FollowUpCell value={item.followUp} interactive={false} />
                </span>
                <span>
                  <span className="crm-website-label">Status</span>
                  <WebsiteLeadStatusBadge status={item.status} />
                </span>
                <ArrowRight className="crm-website-arrow h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-orange-600" />
              </Link>
            ))
          )}
          </div>

          </TableScrollArea>
          {!loading && !error && data && data.meta.total > 0 ? (
            <div className="border-t border-border/70 px-4 py-4 sm:px-5">
              <TablePagination meta={data.meta} onPageChange={setPage}
                summary={`${Math.min((data.meta.page - 1) * PAGE_SIZE + 1, data.meta.total)}–${Math.min(data.meta.page * PAGE_SIZE, data.meta.total)} of ${data.meta.total} website leads`} />
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
  tone: "orange" | "blue" | "slate";
}) {
  const toneClass = {
    orange:
      "border-orange-200 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/20",
    blue: "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/20",
    slate:
      "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50",
  }[tone];
  return (
    <div className={cn("rounded-2xl border px-4 py-3 sm:px-5", toneClass)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
        {value ?? "—"}
      </p>
    </div>
  );
}
