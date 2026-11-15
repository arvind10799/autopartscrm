"use client";
import { outsideCallingWindow } from "./reminder-phase6-api";
import { defaultPolicy } from "./reminder-policy.schema";
import { ReminderSuggestions } from "./ReminderSuggestions";
import { ReminderRepeatFields } from "./ReminderRepeatFields";
import { reminderAutomationApi } from "./reminder-automation-api";
import type {
  ReminderSuggestion,
  ReminderRepeatInput,
} from "./reminder.schema";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  BellRing,
  Check,
  Clock3,
  History,
  Plus,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { cn } from "@/lib/utils/cn";
import { remindersApi } from "./reminders-api";
import {
  displayZones,
  zoneLabels,
  type CreateReminderInput,
  type RecordReminders,
  type ReminderActionInput,
  type ReminderContext,
  type ReminderItem,
} from "./reminder.schema";

type Props = {
  context: ReminderContext;
  recordId: string;
  recordLabel: string;
  ownerUserId?: string | null;
  recordRevision?: string;
  onChanged?: () => void | Promise<void>;
  offerCancel?: boolean;
};
const shippingContexts = ["SHIPMENT_ORDER", "SHIPMENT", "REPLACEMENT"];
const assignmentLabels: Record<string, string> = {
  SELF: "For me",
  RECORD_OWNER: "Record owner",
  SHIPPING_QUEUE: "Hand off to Shipping queue",
  SALES_AGENT: "Hand off to order’s Sales agent",
};
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to update reminders. Please try again.";
}
export function localInput(date: Date, zone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function displayTime(value: string, zone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}
export function reminderDueLabel(
  value: string,
  customerZone: string,
  displayZone: string,
) {
  return (
    displayTime(value, customerZone) +
    (customerZone !== displayZone
      ? ` · ${displayTime(value, displayZone)}`
      : "")
  );
}
function quickTime(kind: number, zone: string) {
  const now = new Date();
  if (kind === 0) return localInput(new Date(now.getTime() + 3600000), zone);
  const local = localInput(now, zone);
  const date = new Date(`${local.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + kind);
  return (
    date.toISOString().slice(0, 10) + (kind === 1 ? "T10:00" : local.slice(10))
  );
}

export function RemindersPanel(props: Props) {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  if (
    user.role === "SALES" &&
    (shippingContexts.includes(props.context) ||
      (props.context !== "PERSONAL" && props.ownerUserId !== user.userId))
  )
    return null;
  if (
    user.role === "SHIPPING" &&
    !shippingContexts.includes(props.context) &&
    props.context !== "PERSONAL"
  )
    return null;
  return <PanelContent {...props} />;
}

function PanelContent({
  context,
  recordId,
  recordLabel,
  onChanged,
  offerCancel,
  recordRevision,
}: Props) {
  const user = useAuthStore((s) => s.user)!;
  const [data, setData] = useState<RecordReminders | null>(null);
  const [past, setPast] = useState<RecordReminders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{
    mode:
      | "create"
      | "edit"
      | "complete"
      | "snooze"
      | "cancel"
      | "delete"
      | "history";
    row?: ReminderItem;
    suggestion?: ReminderSuggestion;
  } | null>(null);
  const [zoneBusy, setZoneBusy] = useState(false);
  const reload = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    setPage(1);
    setHistoryPage(1);
    setData(null);
    setPast(null);
    setModal(null);
  }, [context, recordId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      remindersApi.record(context, recordId, page, false, controller.signal),
      showHistory
        ? remindersApi.record(
            context,
            recordId,
            historyPage,
            true,
            controller.signal,
          )
        : Promise.resolve(null),
    ])
      .then(([current, history]) => {
        if (!controller.signal.aborted) {
          setData(current);
          setPast(history);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    context,
    recordId,
    page,
    historyPage,
    showHistory,
    revision,
    recordRevision,
  ]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("crm:reminders-changed", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("crm:reminders-changed", refresh);
    };
  }, [reload]);
  const changed = async () => {
    setModal(null);
    window.dispatchEvent(new Event("crm:reminders-changed"));
    await onChanged?.();
  };
  const working = async (row: ReminderItem) => {
    setError(null);
    try {
      await remindersApi.action(row.id, {
        action: "WORK",
        version: row.version,
      });
      await changed();
    } catch (e) {
      setError(message(e));
      reload();
    }
  };
  const rows = data?.items ?? [];
  const shippingStrip = context === "ORDER" && user.role === "SALES";
  const normal = shippingStrip
    ? rows.filter((r) => r.ownerKind !== "SHIPPING_QUEUE")
    : rows;
  const queue = shippingStrip
    ? rows.filter((r) => r.ownerKind === "SHIPPING_QUEUE")
    : [];
  const renderRow = (row: ReminderItem, history = false) => (
    <ReminderRow
      key={row.id}
      row={row}
      zone={data?.displayTimeZone ?? displayZones[0]}
      label={
        data?.types.find((t) => t.key === row.typeKey)?.label ??
        row.typeKey.replaceAll("_", " ")
      }
      history={history}
      open={(mode) => setModal({ mode, row })}
      work={() => working(row)}
    />
  );
  return (
    <Card
      id="reminders"
      className="min-w-0 scroll-mt-24 overflow-hidden border-border/70 shadow-sm"
    >
      <CardHeader className="space-y-3 border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellRing className="h-4 w-4 text-orange-500" />
            Reminders
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{data?.openCount ?? 0} open</Badge>
            {!!data?.overdueCount && (
              <Badge variant="danger">{data.overdueCount} overdue</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Refresh reminders"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Your display time zone
            <Select
              aria-label="Reminder display time zone"
              className="h-8 max-w-44 text-xs"
              value={data?.displayTimeZone ?? displayZones[0]}
              disabled={!data || zoneBusy}
              onChange={async (e) => {
                setZoneBusy(true);
                try {
                  await remindersApi.displayZone(e.target.value);
                  window.dispatchEvent(new Event("crm:reminders-changed"));
                } catch (e) {
                  setError(message(e));
                } finally {
                  setZoneBusy(false);
                }
              }}
            >
              {displayZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zoneLabels[zone]}
                </option>
              ))}
            </Select>
          </label>
          <Button
            size="sm"
            disabled={!data?.canCreate}
            onClick={() => setModal({ mode: "create" })}
          >
            <Plus className="h-4 w-4" />
            Add reminder
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3.5">
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"
          >
            {error}{" "}
            <button className="underline" onClick={reload}>
              Retry
            </button>
          </p>
        )}
        {!data && loading && (
          <p className="py-4 text-sm text-muted-foreground">
            Loading reminders…
          </p>
        )}
        {data?.recordClosed && (
          <p className="text-xs text-muted-foreground">
            This record is closed or converted. Its reminder history is
            available below.
          </p>
        )}
        {offerCancel && !!data?.openCount && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            This lead status may no longer need follow-up. Review and cancel any
            reminders that are no longer needed.
          </p>
        )}
        {data?.canCreate && (
          <ReminderSuggestions
            items={data.suggestions}
            context={context}
            recordId={recordId}
            onAdjust={(suggestion) => setModal({ mode: "create", suggestion })}
            onSaved={changed}
          />
        )}
        {normal.map((row) => renderRow(row))}
        {data && !normal.length && (
          <p className="py-3 text-sm text-muted-foreground">
            No open reminders.
          </p>
        )}
        {shippingStrip && (
          <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Truck className="h-4 w-4" />
              Shipping tasks
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Shared Shipping queue · status only
            </p>
            {queue.length ? (
              queue.map((row) => renderRow(row))
            ) : (
              <p className="text-xs text-muted-foreground">
                No open Shipping tasks on this page.
              </p>
            )}
            {!!data?.shippingDone.length && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Recently completed
                </p>
                {data.shippingDone.map((row) => renderRow(row, true))}
              </div>
            )}
          </section>
        )}
        {data && data.total > data.limit && (
          <PageButtons
            page={page}
            total={data.total}
            limit={data.limit}
            setPage={setPage}
          />
        )}
        <button
          type="button"
          className="flex items-center gap-2 text-xs font-medium text-primary"
          onClick={() => setShowHistory((x) => !x)}
        >
          <History className="h-4 w-4" />
          {showHistory ? "Hide history" : "Show history"}
        </button>
        {showHistory && (
          <div className="space-y-3 border-t border-border pt-3">
            {past?.items.map((row) => renderRow(row, true))}
            {past && !past.items.length && (
              <p className="text-xs text-muted-foreground">
                No reminder history yet.
              </p>
            )}
            {past && past.total > past.limit && (
              <PageButtons
                page={historyPage}
                total={past.total}
                limit={past.limit}
                setPage={setHistoryPage}
              />
            )}
          </div>
        )}
      </CardContent>
      {modal && data && (
        <ReminderDialog
          mode={modal.mode}
          row={modal.row}
          suggestion={modal.suggestion}
          data={data}
          context={context}
          recordId={recordId}
          recordLabel={recordLabel}
          onClose={() => setModal(null)}
          onSaved={changed}
          onStale={reload}
        />
      )}
    </Card>
  );
}

function PageButtons({
  page,
  total,
  limit,
  setPage,
}: {
  page: number;
  total: number;
  limit: number;
  setPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <Button
        variant="outline"
        size="sm"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} of {Math.ceil(total / limit)}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page * limit >= total}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
export function ReminderRow({
  row,
  zone,
  label,
  history,
  open,
  work,
  details,
}: {
  row: ReminderItem;
  zone: string;
  label: string;
  history: boolean;
  open: (
    mode: "edit" | "complete" | "snooze" | "cancel" | "delete" | "history",
  ) => void;
  work: () => Promise<void>;
  details?: ReactNode;
}) {
  const [claiming, setClaiming] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  return (
    <article
      className={cn(
        "space-y-2 rounded-xl border border-border border-l-4 bg-card p-3",
        row.priority === "HIGH"
          ? "border-l-red-500"
          : row.priority === "MEDIUM"
            ? "border-l-amber-400"
            : "border-l-slate-300",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-1">
        <p className="min-w-0 break-words text-sm font-semibold">{row.title}</p>
        <Badge variant={row.overdue ? "danger" : "outline"}>
          {row.overdue
            ? "Overdue"
            : row.status === "OPEN"
              ? "Open"
              : row.status === "SNOOZED"
                ? "Snoozed"
                : row.status === "COMPLETED"
                  ? "Done"
                  : "Cancelled"}
        </Badge>
      </div>
      <p
        className={cn(
          "text-xs leading-5",
          row.overdue
            ? "text-red-600 dark:text-red-400"
            : "text-muted-foreground",
        )}
      >
        {reminderDueLabel(row.dueAt, row.timeZone, zone)}
      </p>
      <p className="text-xs text-muted-foreground">
        {label} · {row.priority.toLowerCase()} priority ·{" "}
        {row.ownerKind === "SHIPPING_QUEUE"
          ? "Shipping queue"
          : (row.owner?.name ?? "Admin attention")}
      </p>
      {row.series ? (
        <p className="text-xs font-medium text-primary">
          {row.series.isActive
            ? `Repeating ${row.series.frequency === "WEEKLY" ? "weekly" : row.series.frequency === "DAILY" ? "daily" : `every ${row.series.intervalDays} days`} · occurrence ${row.occurrenceNumber}`
            : `Repeat stopped${row.series.stopReason ? ` · ${row.series.stopReason}` : ""}`}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {row.assignedByAdmin
          ? "Assigned by Admin"
          : row.isHandoff
            ? `Handoff from ${row.createdBy.name}`
            : `Created by ${row.createdBy.name}`}
        {row.workingBy ? ` · Working on it: ${row.workingBy.name}` : ""}
        {row.needsAdmin ? " · Owner inactive — Admin review needed" : ""}
      </p>
      {row.note && (
        <p className="whitespace-pre-wrap break-words text-xs leading-5">
          {row.note}
        </p>
      )}
      {details}
      {history && (
        <p className="text-xs text-muted-foreground">
          {row.deletedAt ? "Deleted · " : ""}
          {row.completionNote ??
            row.cancelReason ??
            (row.status === "OPEN" || row.status === "SNOOZED"
              ? "Continued on the converted record."
              : "")}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {!history && row.actions.complete && (
          <SmallButton onClick={() => open("complete")}>
            <Check className="h-3 w-3" />
            Complete
          </SmallButton>
        )}
        {!history && row.actions.snooze && (
          <SmallButton onClick={() => open("snooze")}>
            <Clock3 className="h-3 w-3" />
            Snooze
          </SmallButton>
        )}
        {!history && row.actions.edit && (
          <>
            <SmallButton onClick={() => open("edit")}>Edit</SmallButton>
            <SmallButton onClick={() => open("cancel")}>
              {row.series?.isActive ? "Stop repeating" : "Cancel"}
            </SmallButton>
          </>
        )}
        {!history && row.actions.delete && (
          <SmallButton onClick={() => open("delete")}>Delete</SmallButton>
        )}
        {!history && row.actions.work && (
          <SmallButton
            disabled={
              claiming ||
              (!!row.workingBy && row.workingById !== currentUser?.userId)
            }
            onClick={async () => {
              setClaiming(true);
              try {
                await work();
              } finally {
                setClaiming(false);
              }
            }}
          >
            {row.workingBy ? "Working on it" : "Work on this"}
          </SmallButton>
        )}
        <SmallButton onClick={() => open("history")}>History</SmallButton>
      </div>
    </article>
  );
}
function SmallButton({
  children,
  ...props
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <Button {...props} variant="outline" size="sm" className="h-7 px-2 text-xs">
      {children}
    </Button>
  );
}

export function ReminderDialog({
  mode,
  row,
  data,
  context,
  recordId,
  recordLabel,
  onClose,
  onSaved,
  onStale,
  initialDueAt,
  suggestion,
}: {
  mode:
    | "create"
    | "edit"
    | "complete"
    | "snooze"
    | "cancel"
    | "delete"
    | "history";
  row?: ReminderItem;
  data: RecordReminders;
  context: ReminderContext;
  recordId: string;
  recordLabel: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onStale: () => void;
  initialDueAt?: string;
  suggestion?: ReminderSuggestion;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [personalZone, setPersonalZone] = useState(
    row?.timeZone ?? data.displayTimeZone,
  );
  const [title, setTitle] = useState(
    row?.title ??
      suggestion?.label ??
      `${data.types[0]?.label ?? "Follow-up"} – ${recordLabel}`.slice(0, 120),
  );
  const [typeKey, setType] = useState(
    row?.typeKey ?? suggestion?.typeKey ?? data.types[0]?.key ?? "CUSTOM",
  );
  const [assignment, setAssignment] = useState(
    suggestion?.assignment ??
      (data.assignments.includes("RECORD_OWNER")
        ? "RECORD_OWNER"
        : (data.assignments[0] ?? "SELF")),
  );
  const [time, setTime] = useState(
    row?.localDueAt ??
      (suggestion ? (suggestion.localDueAt ?? "") : undefined) ??
      (initialDueAt
        ? localInput(
            new Date(initialDueAt),
            context === "PERSONAL" ? personalZone : data.timeZone,
          )
        : quickTime(0, context === "PERSONAL" ? personalZone : data.timeZone)),
  );
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">(
    row?.priority ?? "MEDIUM",
  );
  const [note, setNote] = useState(row?.note ?? "");
  const [outcome, setOutcome] = useState("");
  const [early, setEarly] = useState(row?.earlyAlertMinutes ?? 0);
  const [offset, setOffset] = useState("");
  const policy = data.policy ?? defaultPolicy;
  const [snooze, setSnooze] = useState(String(policy.snoozeMinutes[0] ?? 15));
  const [duplicate, setDuplicate] = useState(false);
  const [notify, setNotify] = useState(true);
  const [repeat, setRepeat] = useState<ReminderRepeatInput>(
    suggestion?.repeat ??
      (row?.series
        ? {
            frequency: row.series.frequency,
            ...(row.series.frequency === "EVERY_N_DAYS"
              ? { intervalDays: row.series.intervalDays }
              : {}),
            ...(row.series.frequency === "WEEKLY"
              ? { weekday: row.series.weekday ?? 1 }
              : {}),
            untilDate: row.series.untilDate ?? undefined,
            maxOccurrences: row.series.maxOccurrences ?? undefined,
            stopStatus:
              (row.series.stopStatus as ReminderRepeatInput["stopStatus"]) ??
              undefined,
          }
        : { frequency: "NONE" }),
  );
  const [repeatScope, setRepeatScope] = useState<"THIS" | "FUTURE">(
    row?.series ? "THIS" : "FUTURE",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Awaited<
    ReturnType<typeof remindersApi.history>
  > | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    let active = true;
    if (mode === "history" && row)
      remindersApi
        .history(row.id)
        .then((h) => {
          if (active) setHistory(h);
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    return () => {
      active = false;
    };
  }, [mode, row]);
  const zone =
    context === "PERSONAL" ? personalZone : (row?.timeZone ?? data.timeZone);
  const submitting = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const utcOffsetMinutes = offset === "" ? undefined : Number(offset);
      if (mode === "create") {
        const input: CreateReminderInput = {
          context,
          recordId: context === "PERSONAL" ? undefined : recordId,
          title,
          typeKey,
          assignment: assignment as CreateReminderInput["assignment"],
          localDueAt: time,
          ...(context === "PERSONAL"
            ? { timeZone: personalZone as CreateReminderInput["timeZone"] }
            : {}),
          priority,
          note,
          earlyAlertMinutes: early as 0 | 5 | 15 | 30,
          utcOffsetMinutes,
          acknowledgeDuplicate: duplicate,
          repeat,
          ...(["SHIPPING_QUEUE", "SALES_AGENT"].includes(assignment)
            ? { notifyCreatorOnCompletion: notify }
            : {}),
        };
        if (suggestion) await reminderAutomationApi.accept(suggestion, input);
        else await remindersApi.create(input);
      } else if (row) {
        let input: ReminderActionInput;
        if (mode === "edit")
          input = {
            action: "EDIT",
            version: row.version,
            title,
            typeKey,
            note,
            priority,
            localDueAt: time,
            ...(context === "PERSONAL"
              ? { timeZone: personalZone as CreateReminderInput["timeZone"] }
              : {}),
            earlyAlertMinutes: early as 0 | 5 | 15 | 30,
            utcOffsetMinutes,
            ...(row.series || repeat.frequency !== "NONE"
              ? { repeatScope, ...(repeatScope === "FUTURE" ? { repeat } : {}) }
              : {}),
          };
        else if (mode === "complete")
          input = {
            action: "COMPLETE",
            version: row.version,
            completionNote: outcome,
          };
        else if (mode === "snooze")
          input = {
            action: "SNOOZE",
            version: row.version,
            ...(snooze === "CUSTOM"
              ? { localDueAt: time, utcOffsetMinutes }
              : { snoozeMinutes: Number(snooze) }),
          };
        else if (mode === "delete")
          input = { action: "DELETE", version: row.version };
        else
          input = {
            action: "CANCEL",
            version: row.version,
            cancelReason: outcome || undefined,
          };
        await remindersApi.action(row.id, input);
      }
      await onSaved();
    } catch (e) {
      setError(message(e));
      onStale();
    } finally {
      setBusy(false);
    }
  };
  const scheduling =
    mode === "create" ||
    mode === "edit" ||
    (mode === "snooze" && snooze === "CUSTOM");
  const heading =
    mode === "create"
      ? "Add reminder"
      : mode === "history"
        ? "Reminder history"
        : `${mode[0].toUpperCase() + mode.slice(1)} reminder`;
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="reminder-dialog-title"
      className="m-auto max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/45"
    >
      <form onSubmit={submitting}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 id="reminder-dialog-title" className="font-semibold">
            {heading}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Close reminder dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <fieldset disabled={busy} className="space-y-4 p-4">
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {mode === "create" || mode === "edit" ? (
            <>
              <Field label="Type">
                <Select
                  value={typeKey}
                  disabled={Boolean(suggestion)}
                  onChange={(e) => {
                    setType(e.target.value);
                    if (mode === "create")
                      setTitle(
                        `${data.types.find((t) => t.key === e.target.value)?.label ?? "Follow-up"} – ${recordLabel}`.slice(
                          0,
                          120,
                        ),
                      );
                  }}
                >
                  {!data.types.some((t) => t.key === typeKey) && (
                    <option value={typeKey}>
                      {typeKey.replaceAll("_", " ")}
                    </option>
                  )}
                  {data.types.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Title">
                <Input
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              {mode === "create" && (
                <Field label="Assign to">
                  <Select
                    value={assignment}
                    disabled={Boolean(suggestion)}
                    onChange={(e) => setAssignment(e.target.value)}
                  >
                    {data.assignments.map((a) => (
                      <option key={a} value={a}>
                        {a === "RECORD_OWNER" &&
                        shippingContexts.includes(context)
                          ? "Shared Shipping queue"
                          : assignmentLabels[a]}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <Select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as typeof priority)
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Select>
                </Field>
                <Field label="Early alert">
                  <Select
                    value={early}
                    onChange={(e) => setEarly(Number(e.target.value))}
                  >
                    {[0, 5, 15, 30].map((n) => (
                      <option key={n} value={n}>
                        {n ? `${n} min before` : "At due time"}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Note (optional)">
                <Textarea
                  maxLength={1000}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              {mode === "edit" && row?.series ? (
                <Field label="Apply edits to">
                  <Select
                    aria-label="Repeat edit scope"
                    value={repeatScope}
                    onChange={(e) =>
                      setRepeatScope(e.target.value as "THIS" | "FUTURE")
                    }
                  >
                    <option value="THIS">This occurrence only</option>
                    {row.series.isActive ? (
                      <option value="FUTURE">
                        This and future occurrences
                      </option>
                    ) : null}
                  </Select>
                </Field>
              ) : null}
              {mode === "create" || repeatScope === "FUTURE" ? (
                <ReminderRepeatFields
                  value={repeat}
                  onChange={setRepeat}
                  context={context}
                />
              ) : row?.series ? (
                <p className="text-xs text-muted-foreground">
                  The repeating schedule is unchanged by edits to this
                  occurrence.
                </p>
              ) : null}
              {mode === "create" &&
                ["SHIPPING_QUEUE", "SALES_AGENT"].includes(assignment) && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={notify}
                      onChange={(e) => setNotify(e.target.checked)}
                    />
                    Notify me when done
                  </label>
                )}
            </>
          ) : null}
          {mode === "snooze" && (
            <Field label="Snooze for">
              <Select
                value={snooze}
                onChange={(e) => setSnooze(e.target.value)}
              >
                {policy.snoozeMinutes.map((n) => (
                  <option key={n} value={String(n)}>
                    {n % 1440 === 0
                      ? `${n / 1440} day${n === 1440 ? "" : "s"}`
                      : n % 60 === 0
                        ? `${n / 60} hour${n === 60 ? "" : "s"}`
                        : `${n} minutes`}
                  </option>
                ))}
                <option value="CUSTOM">Custom time</option>
              </Select>
            </Field>
          )}
          {scheduling && (
            <>
              {context === "PERSONAL" &&
                (mode === "create" || mode === "edit") && (
                  <Field label="Task time zone">
                    <Select
                      value={personalZone}
                      onChange={(event) => setPersonalZone(event.target.value)}
                    >
                      {displayZones.map((value) => (
                        <option key={value} value={value}>
                          {zoneLabels[value]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              <Field label={`Due date and time · ${zoneLabels[zone] ?? zone}`}>
                <Input
                  required
                  type="datetime-local"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                {context === "PERSONAL"
                  ? "Entered in the task’s chosen time zone."
                  : "Entered in the customer’s local time."}{" "}
                Your display zone:{" "}
                {zoneLabels[data.displayTimeZone] ?? data.displayTimeZone}.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  [0, "In 1 hour"],
                  [1, "Tomorrow 10 AM"],
                  [3, "In 3 days"],
                  [7, "Next week"],
                ].map(([n, label]) => (
                  <SmallButton
                    key={n}
                    onClick={() => setTime(quickTime(Number(n), zone))}
                  >
                    {label}
                  </SmallButton>
                ))}
              </div>
              {["CALL", "TEXT"].includes(typeKey) &&
              outsideCallingWindow(time, policy) ? (
                <p
                  role="status"
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  This Call/Text is outside the configured calling window in the
                  task's local time zone. You can still save it.
                </p>
              ) : null}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  Daylight-saving time occurs twice?
                </summary>
                <Field label="Choose an offset only if requested">
                  <Select
                    value={offset}
                    onChange={(e) => setOffset(e.target.value)}
                  >
                    <option value="">Automatic</option>
                    {[-240, -300, -360, -420, -480].map((n) => (
                      <option key={n} value={n}>
                        UTC{n / 60}:00
                      </option>
                    ))}
                  </Select>
                </Field>
              </details>
            </>
          )}
          {mode === "create" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={duplicate}
                onChange={(e) => setDuplicate(e.target.checked)}
              />
              Save anyway if a similar reminder already exists
            </label>
          )}
          {mode === "complete" && (
            <Field label="Completion note (optional)">
              <Textarea
                maxLength={1000}
                rows={4}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                {context === "PERSONAL"
                  ? "Saved in this task’s completion history."
                  : "Saved to this record’s notes with your name."}
              </span>
            </Field>
          )}
          {mode === "cancel" && (
            <Field label="Cancellation reason (optional)">
              <Textarea
                rows={3}
                maxLength={255}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </Field>
          )}
          {mode === "delete" && (
            <p className="text-sm">
              Delete “{row?.title}”? The reminder will be removed from the open
              list and retained in history.
            </p>
          )}
          {(mode === "cancel" || mode === "delete") && row?.series?.isActive ? (
            <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
              This stops the repeating schedule and cancels its current task.
              Previous occurrences and history are retained.
            </p>
          ) : null}
          {mode === "complete" && row?.series?.isActive ? (
            <p className="text-sm text-muted-foreground">
              Completing this occurrence schedules the next future occurrence,
              unless an ending condition has been reached.
            </p>
          ) : null}
          {mode === "history" && (
            <div className="space-y-3">
              {!history && !error && (
                <p className="text-sm text-muted-foreground">
                  Loading history…
                </p>
              )}
              {history?.map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 border-orange-300 pl-3 text-xs"
                >
                  <p className="font-semibold">
                    {entry.action.replaceAll("_", " ")} ·{" "}
                    {entry.actor?.name ?? "CRM automatic action"}
                  </p>
                  <p className="text-muted-foreground">
                    {displayTime(entry.createdAt, data.displayTimeZone)}
                  </p>
                  {typeof entry.changes?.reason === "string" && (
                    <p>{entry.changes.reason}</p>
                  )}
                  {typeof entry.changes?.completionNote === "string" && (
                    <p>{entry.changes.completionNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </fieldset>
        {mode !== "history" && (
          <div className="flex justify-end gap-2 border-t border-border p-4">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Back
            </Button>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Saving…"
                : mode === "delete"
                  ? "Delete reminder"
                  : mode === "complete"
                    ? "Mark complete"
                    : mode === "snooze"
                      ? "Snooze reminder"
                      : mode === "cancel"
                        ? "Cancel reminder"
                        : "Save reminder"}
            </Button>
          </div>
        )}
      </form>
    </dialog>,
    document.body,
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
