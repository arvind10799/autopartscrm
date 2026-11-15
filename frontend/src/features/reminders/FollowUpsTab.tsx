"use client";
import { ReminderReports } from "./ReminderReports";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { displayZones, zoneLabels } from "./reminder.schema";
import { useTaskSummary } from "./TaskSummaryProvider";
import { localInput, reminderDueLabel } from "./RemindersPanel";
import { shiftTaskDate } from "./task-calendar";
import { taskWorkspaceApi, type FollowUpsReport } from "./task-workspace-api";
export function FollowUpsTab({
  period,
  month,
  startDate,
  endDate,
}: {
  period: string;
  month: string;
  startDate: string;
  endDate: string;
}) {
  const { summary } = useTaskSummary();
  const [zone, setZone] = useState(
      summary?.displayTimeZone ?? "America/Los_Angeles",
    ),
    [data, setData] = useState<FollowUpsReport | null>(null),
    [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (summary?.displayTimeZone) setZone(summary.displayTimeZone);
  }, [summary?.displayTimeZone]);
  const params = useMemo(() => {
    const today = localInput(new Date(), zone).slice(0, 10);
    let from = today,
      to = today;
    if (period === "yesterday") from = to = shiftTaskDate(today, -1);
    if (period === "last-week") from = shiftTaskDate(today, -6);
    if (period === "custom") {
      from = startDate;
      to = endDate;
    }
    if (period === "month") {
      from = `${month}-01`;
      const next = new Date(`${from}T12:00Z`);
      next.setUTCMonth(next.getUTCMonth() + 1);
      to = shiftTaskDate(next.toISOString().slice(0, 10), -1);
    }
    return { from, to, displayTimeZone: zone };
  }, [period, month, startDate, endDate, zone]);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    taskWorkspaceApi
      .followUps(params, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Follow-ups unavailable.");
      });
    return () => controller.abort();
  }, [params, revision]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRevision((v) => v + 1);
    };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("crm:reminders-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("crm:reminders-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Follow-ups</h2>
          <p className="text-sm text-muted-foreground">
            Open tasks due {params.from} through {params.to} ·{" "}
            {zoneLabels[zone]}
          </p>
        </div>
        <label className="text-xs text-muted-foreground">
          Report time zone
          <Select value={zone} onChange={(e) => setZone(e.target.value)}>
            {displayZones.map((value) => (
              <option key={value} value={value}>
                {zoneLabels[value]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 p-3 text-sm text-red-600"
        >
          {error}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevision((v) => v + 1)}
          >
            Retry
          </Button>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            [
              "Inactive / unassigned",
              "unassigned",
              "/my-tasks?scope=UNASSIGNED",
            ],
            [
              "Repeated snoozes",
              "flagged",
              "/my-tasks?scope=TEAM&flagged=true",
            ],
            [
              "Handoffs to Shipping",
              "handoffsToShipping",
              "/my-tasks?scope=QUEUE",
            ],
            [
              "Handoffs to Sales",
              "handoffsToSales",
              "/my-tasks?scope=TEAM&context=ORDER&handoff=true",
            ],
          ] as const
        ).map(([title, key, href]) => (
          <Link
            href={href}
            key={key}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary"
          >
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-semibold">
              {data ? data[key] : "—"}
            </p>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Overdue by owner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Open</th>
                  <th className="p-3">Overdue</th>
                  <th className="p-3">Oldest due time</th>
                  <th className="p-3">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70">
                    <td className="p-3 font-medium">
                      {row.name}
                      {!row.isActive && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-3">{row.open}</td>
                    <td
                      className={`p-3 ${row.overdue ? "font-semibold text-red-600" : ""}`}
                    >
                      {row.overdue}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {row.oldest
                        ? reminderDueLabel(row.oldest, zone, zone)
                        : "—"}
                    </td>
                    <td className="p-3">
                      <Link
                        className="font-medium text-primary"
                        href={
                          row.id === "QUEUE"
                            ? "/my-tasks?scope=QUEUE"
                            : `/my-tasks?scope=TEAM&ownerId=${row.id}`
                        }
                      >
                        View tasks
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data && !error && (
              <p className="p-4 text-sm text-muted-foreground">
                Loading team follow-ups…
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <ReminderReports {...params} />
    </div>
  );
}
