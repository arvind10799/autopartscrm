"use client";
import { openReminderAlert } from "./ReminderAlertDialog";
import type { TableFollowUp } from "./follow-up.schema";
import { useTaskSummary } from "./TaskSummaryProvider";
export function FollowUpCell({
  value,
  interactive = true,
}: {
  value?: TableFollowUp | null;
  interactive?: boolean;
}) {
  const { summary } = useTaskSummary();
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value.dueAt));
  const customer = format(value.timeZone),
    zone = summary?.displayTimeZone ?? value.timeZone;
  const content = (
    <>
      <span className="block text-xs font-medium">
        {value.overdue ? "● Overdue · " : ""}
        {value.typeLabel}
      </span>
      <span className="block text-[11px]">{customer}</span>
      {zone !== value.timeZone ? (
        <span className="block text-[10px] text-muted-foreground">
          {format(zone)}
        </span>
      ) : null}
    </>
  );
  const className = `block min-w-0 max-w-[175px] whitespace-normal text-left leading-4 ${value.overdue ? "text-red-600 dark:text-red-400" : "text-foreground"}`;
  return interactive ? (
    <button
      type="button"
      className={className}
      title="Open reminder"
      onClick={(e) => {
        e.stopPropagation();
        openReminderAlert({ id: value.id });
      }}
    >
      {content}
    </button>
  ) : (
    <span className={className}>{content}</span>
  );
}
