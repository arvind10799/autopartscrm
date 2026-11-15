"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { reminderAutomationApi } from "./reminder-automation-api";
import type { ReminderContext, ReminderSuggestion } from "./reminder.schema";
export function ReminderSuggestions({
  items,
  context,
  recordId,
  onAdjust,
  onSaved,
}: {
  items: ReminderSuggestion[];
  context: ReminderContext;
  recordId: string;
  onAdjust: (s: ReminderSuggestion) => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  if (!items.length) return null;
  const act = async (s: ReminderSuggestion, dismiss = false) => {
    setBusy(s.id);
    setError("");
    try {
      if (dismiss) await reminderAutomationApi.dismiss(s);
      else
        await reminderAutomationApi.accept(s, {
          context,
          recordId,
          typeKey: s.typeKey,
          title: s.label,
          assignment: s.assignment,
          localDueAt: s.localDueAt!,
          repeat: s.repeat,
        });
      await onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The suggestion changed. Refresh and try again.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <section
      className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/40 p-3 dark:border-orange-900 dark:bg-orange-950/10"
      aria-label="Suggested reminders"
    >
      <h3 className="text-sm font-semibold">Suggested next steps</h3>
      <p className="text-xs text-muted-foreground">
        Review a suggestion before adding it. Dismissed suggestions stay hidden
        for this status change.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
      {items.map((s) => (
        <div key={s.id} className="space-y-2 rounded-lg border bg-card p-3">
          <p className="text-sm font-medium">{s.label}</p>
          <p className="text-xs text-muted-foreground">
            {s.typeLabel} ·{" "}
            {s.localDueAt
              ? `${s.localDueAt.replace("T", " ")} · ${s.timeZone}`
              : "Choose the time agreed with the customer"}
            {s.repeat ? ` · Repeats every ${s.repeat.intervalDays} day(s)` : ""}
            {s.assignment === "SALES_AGENT"
              ? " · Handoff to the order agent"
              : ""}
          </p>
          {s.alreadyScheduled ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              A similar open reminder already exists. Check it below or review
              the time before adding another.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                s.requiresTime || s.alreadyScheduled ? onAdjust(s) : void act(s)
              }
            >
              {s.requiresTime
                ? "Choose callback time"
                : s.alreadyScheduled
                  ? "Review time"
                  : "Add reminder"}
            </Button>
            {!s.requiresTime ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => onAdjust(s)}
              >
                Change time
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => void act(s, true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
