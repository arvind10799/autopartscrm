"use client";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { useTaskSummary } from "./TaskSummaryProvider";
export function MyRemindersStrip() {
  const { summary, error } = useTaskSummary();
  return (
    <section
      aria-label="My reminders"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="mr-auto flex items-center gap-2 text-sm font-semibold">
        <BellRing className="h-4 w-4 text-primary" />
        My reminders
      </div>
      {error ? (
        <Link href="/my-tasks" className="text-xs text-muted-foreground">
          Open tasks · counts unavailable
        </Link>
      ) : (
        (
          [
            ["Overdue", "overdue", "OVERDUE"],
            ["Due today", "today", "TODAY"],
            ["Next 7 days", "upcoming", "UPCOMING"],
            ["New handoffs", "newHandoffs", "NEW"],
          ] as const
        ).map(([title, key, tab]) => (
          <Link
            key={key}
            href={`/my-tasks?tab=${tab}`}
            className={`rounded-xl border border-border px-3 py-2 text-xs transition hover:border-primary ${key === "overdue" && summary?.overdue ? "text-red-600" : "text-muted-foreground"}`}
          >
            <strong className="mr-1 text-sm">
              {summary ? summary[key] : "—"}
            </strong>
            {title}
          </Link>
        ))
      )}
    </section>
  );
}
