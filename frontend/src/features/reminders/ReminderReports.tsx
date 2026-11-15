"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  reminderPhase6Api,
  downloadReminderFile,
  type ReminderReport,
} from "./reminder-phase6-api";
import { FollowUpCell } from "./FollowUpCell";
const kinds = [
  ["LEADS_NO_NEXT", "Leads without a next step"],
  ["WEBSITE_NO_NEXT", "Website inquiries without a next step"],
  ["UNSIGNED", "Unsigned invoices"],
  ["UNCHECKED_SHIPMENTS", "Shipments without a check in 48 hours"],
  ["PERFORMANCE", "Completion performance"],
] as const;
export function ReminderReports({
  from,
  to,
  displayTimeZone,
}: {
  from: string;
  to: string;
  displayTimeZone: string;
}) {
  const search = useSearchParams(),
    [kind, setKind] = useState(() => {
      const value = search.get("report");
      return kinds.some((k) => k[0] === value) ? value! : "LEADS_NO_NEXT";
    }),
    [owner, setOwner] = useState(""),
    [type, setType] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<ReminderReport | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [exporting, setExporting] = useState(false);
  useEffect(() => setPage(1), [kind, owner, type, from, to, displayTimeZone]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void reminderPhase6Api
      .report(
        {
          kind,
          from,
          to,
          displayTimeZone,
          ownerId: owner || undefined,
          typeKey: type || undefined,
          page,
          limit: 20,
        },
        controller.signal,
      )
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load report.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, owner, type, from, to, displayTimeZone, page, revision]);
  useEffect(() => {
    const refresh = () => setRevision((v) => v + 1);
    window.addEventListener("crm:reminders-changed", refresh);
    return () => window.removeEventListener("crm:reminders-changed", refresh);
  }, []);
  const performance = kind === "PERFORMANCE";
  return (
    <section
      className="space-y-3 rounded-xl border bg-card p-4 sm:p-5"
      aria-label="Follow-up insights"
    >
      <h3 className="text-lg font-semibold">Follow-up insights</h3>
      <div className="flex flex-wrap gap-2">
        <Select
          className="w-full sm:w-[300px]"
          aria-label="Follow-up report"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            const url = new URL(window.location.href);
            url.searchParams.set("report", e.target.value);
            window.history.replaceState(null, "", url.pathname + url.search);
          }}
        >
          {kinds.map(([key, title]) => (
            <option value={key} key={key}>
              {title}
            </option>
          ))}
        </Select>
        <Select
          className="w-full sm:w-48"
          aria-label="Report owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="">All users</option>
          {data?.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </Select>
        {performance ||
        kind === "LEADS_NO_NEXT" ||
        kind === "WEBSITE_NO_NEXT" ? (
          <Select
            className="w-full sm:w-48"
            aria-label="Report reminder type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All task types</option>
            {data?.types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        ) : null}
        <Button
          variant="outline"
          disabled={exporting || loading}
          onClick={() => {
            setExporting(true);
            void downloadReminderFile(
              "reports/export.xlsx",
              {
                kind,
                from,
                to,
                displayTimeZone,
                ownerId: owner || undefined,
                typeKey: type || undefined,
              },
              "follow-ups.xlsx",
            )
              .catch((e) =>
                setError(e instanceof Error ? e.message : "Export failed."),
              )
              .finally(() => setExporting(false));
          }}
        >
          {exporting ? "Exporting…" : "Export Excel"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {data?.periodBasis ?? "Report period"} · {from} through {to} ·{" "}
        {displayTimeZone}.{" "}
        {kind === "UNCHECKED_SHIPMENTS"
          ? "Checks must be future Tracking Checks due within the next 48 hours."
          : performance
            ? "Manual completions only. Early queue completions have zero delay."
            : kind === "UNSIGNED"
              ? "Signature Follow-up status is shown; cancelled/refunded orders are excluded."
              : "Only actionable, open records are included. Overdue-only records still need a future next step."}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRevision((v) => v + 1)}
          >
            Retry
          </Button>
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading report…
        </p>
      ) : !error ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  {(performance
                    ? [
                        "User",
                        "Type",
                        "Completed",
                        "On time",
                        "On-time %",
                        "Queue completions",
                        "Avg. queue delay",
                      ]
                    : [
                        "Record / customer",
                        "Owner",
                        "Record date",
                        "Next outstanding task",
                      ]
                  ).map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    {performance ? (
                      <>
                        <td className="p-3">{r.owner}</td>
                        <td className="p-3">{r.type}</td>
                        <td className="p-3">{r.completed}</td>
                        <td className="p-3">{r.onTime}</td>
                        <td className="p-3">{r.onTimePercent}%</td>
                        <td className="p-3">{r.queueCount}</td>
                        <td className="p-3">
                          {r.queueDelayMinutes === null
                            ? "—"
                            : `${r.queueDelayMinutes} min`}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3">
                          <Link
                            className="font-medium text-primary hover:underline"
                            href={r.href}
                          >
                            {r.reference} · {r.customer}
                          </Link>
                        </td>
                        <td className="p-3">{r.owner}</td>
                        <td className="p-3 text-xs">
                          {new Intl.DateTimeFormat("en-US", {
                            timeZone: displayTimeZone,
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(r.date))}
                        </td>
                        <td className="p-3">
                          {r.followUp ? (
                            <FollowUpCell value={r.followUp} />
                          ) : (
                            <span className="text-xs text-amber-700">
                              No open{" "}
                              {kind === "UNSIGNED"
                                ? "signature follow-up"
                                : kind === "UNCHECKED_SHIPMENTS"
                                  ? "tracking check"
                                  : "reminder"}
                            </span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.rows.length ? (
              <p className="p-5 text-sm text-muted-foreground">
                No matching records in this period.
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{data?.total ?? 0} results</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {Math.max(1, Math.ceil((data?.total ?? 0) / 20))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * 20 >= (data?.total ?? 0)}
                onClick={() => setPage((v) => v + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
