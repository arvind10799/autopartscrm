"use client";
import { downloadReminderFile } from "./reminder-phase6-api";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  GripVertical,
  ArrowUpRight,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ReminderPreferencesDisclosure } from "./ReminderNotificationSettings";
import type { AuthUser } from "@/features/auth/types/auth.types";
import {
  ReminderDialog,
  ReminderRow,
  localInput,
  reminderDueLabel,
} from "./RemindersPanel";
import { remindersApi } from "./reminders-api";
import {
  displayZones,
  zoneLabels,
  type ReminderContext,
  type RecordReminders,
} from "./reminder.schema";
import {
  taskWorkspaceApi,
  contextLabels,
  type TaskItem,
  type TaskWorkspace as WorkspaceData,
  type TaskRecordChoice,
} from "./task-workspace-api";
import {
  calendarDays,
  displayClockToUtc,
  shiftTaskDate,
  shiftCalendarMonth,
  taskDayLabel,
} from "./task-calendar";
import { useTaskSummary } from "./TaskSummaryProvider";

type Filters = {
  scope: string;
  tab: string;
  search: string;
  context: string;
  typeKey: string;
  priority: string;
  status: string;
  ownerId: string;
  working: string;
  flagged: string;
  handoff: string;
  from: string;
  to: string;
  page: string;
  view: string;
  day: string;
  color: string;
};
type ActionMode =
  | "complete"
  | "snooze"
  | "edit"
  | "cancel"
  | "delete"
  | "history";
const views = ["agenda", "queue", "day", "week", "month"];
const filterKeys = [
  "scope",
  "tab",
  "search",
  "context",
  "typeKey",
  "priority",
  "status",
  "ownerId",
  "working",
  "flagged",
  "handoff",
  "from",
  "to",
  "page",
  "view",
  "day",
  "color",
] as const;
const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to load tasks.";
function initialFilters(
  search: URLSearchParams,
  user: AuthUser,
  calendar: boolean,
  zone: string,
): Filters {
  const result: Filters = {
    scope: calendar
      ? user.role === "ADMIN"
        ? "TEAM"
        : user.role === "SHIPPING"
          ? "QUEUE"
          : "MINE"
      : "MINE",
    tab: "ALL",
    search: "",
    context: "",
    typeKey: "",
    priority: "",
    status: "",
    ownerId: "",
    working: "",
    flagged: "",
    handoff: "",
    from: "",
    to: "",
    page: "1",
    view:
      user.role === "ADMIN"
        ? "week"
        : user.role === "SHIPPING"
          ? "queue"
          : "agenda",
    day: localInput(new Date(), zone).slice(0, 10),
    color: "priority",
  };
  for (const key of filterKeys)
    if (search.get(key)) result[key] = search.get(key)!;
  if (!views.includes(result.view)) result.view = "agenda";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result.day) ||
    !Number.isFinite(Date.parse(`${result.day}T12:00Z`))
  )
    result.day = localInput(new Date(), zone).slice(0, 10);
  if (!/^\d+$/.test(result.page) || Number(result.page) < 1) result.page = "1";
  return result;
}
export function TaskWorkspace({ calendar = false }: { calendar?: boolean }) {
  const user = useAuthStore((s) => s.user);
  return user ? (
    <Workspace
      key={`${user.userId}:${calendar}`}
      user={user}
      calendar={calendar}
    />
  ) : (
    <p className="text-sm text-muted-foreground">Loading tasks…</p>
  );
}
function Workspace({ user, calendar }: { user: AuthUser; calendar: boolean }) {
  const router = useRouter(),
    search = useSearchParams();
  const { summary, refresh: refreshSummary } = useTaskSummary();
  const [zone, setZone] = useState(
    summary?.displayTimeZone ?? "America/Los_Angeles",
  );
  const [filters, setFilters] = useState(() =>
    initialFilters(
      new URLSearchParams(search.toString()),
      user,
      calendar,
      zone,
    ),
  );
  const [data, setData] = useState<WorkspaceData | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<{
    mode: ActionMode;
    row: TaskItem;
  } | null>(null);
  const [create, setCreate] = useState<{ dueAt?: string } | null>(null),
    [chosen, setChosen] = useState<{
      context: ReminderContext;
      recordId: string;
      label: string;
      data: RecordReminders;
      dueAt?: string;
    } | null>(null);
  const [move, setMove] = useState<{ row: TaskItem; dueAt: string } | null>(
    null,
  );
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [zoneBusy, setZoneBusy] = useState(false);
  const initialZoneReady = useRef(Boolean(summary?.displayTimeZone));
  const hadExplicitDay = useRef(Boolean(search.get("day")));
  const revisionFn = useCallback(() => setRevision((v) => v + 1), []);
  const [deferredSearch, setDeferredSearch] = useState(filters.search);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDeferredSearch(filters.search),
      300,
    );
    return () => clearTimeout(timer);
  }, [filters.search]);
  const isTimeline =
    calendar && ["day", "week", "month"].includes(filters.view);
  const days = useMemo(
    () => calendarDays(filters.day, filters.view),
    [filters.day, filters.view],
  );
  useEffect(() => {
    if (summary?.displayTimeZone) {
      setZone(summary.displayTimeZone);
      if (!initialZoneReady.current && !hadExplicitDay.current)
        setFilters((previous) => ({
          ...previous,
          day: localInput(new Date(), summary.displayTimeZone).slice(0, 10),
          page: "1",
        }));
      initialZoneReady.current = true;
    }
  }, [summary?.displayTimeZone]);
  const params = useMemo(
    () => ({
      scope: filters.view === "queue" && calendar ? "QUEUE" : filters.scope,
      tab: filters.tab,
      search: deferredSearch || undefined,
      context: filters.context || undefined,
      typeKey: filters.typeKey || undefined,
      priority: filters.priority || undefined,
      status: filters.status || undefined,
      ownerId: filters.ownerId || undefined,
      working: filters.working || undefined,
      flagged: filters.flagged || undefined,
      handoff: filters.handoff || undefined,
      from: isTimeline
        ? days[0]
        : filters.from && filters.to
          ? filters.from
          : undefined,
      to: isTimeline
        ? days.at(-1)
        : filters.from && filters.to
          ? filters.to
          : undefined,
      calendar: isTimeline,
      limit: isTimeline ? 500 : 20,
      page: Number(filters.page),
      displayTimeZone: zone,
    }),
    [
      filters.scope,
      filters.tab,
      filters.context,
      filters.typeKey,
      filters.priority,
      filters.status,
      filters.ownerId,
      filters.working,
      filters.flagged,
      filters.handoff,
      filters.from,
      filters.to,
      filters.page,
      filters.view,
      calendar,
      deferredSearch,
      isTimeline,
      days,
      zone,
    ],
  );
  const viewData = useMemo(() => {
    if (!data) return null;
    const query = new URLSearchParams();
    for (const key of filterKeys)
      if (filters[key]) query.set(key, filters[key]);
    const returnTo = `${calendar ? "/calendar" : "/my-tasks"}?${query}`;
    return {
      ...data,
      items: data.items.map((row) => {
        if (!row.record.href) return row;
        const [pathname, hash] = row.record.href.split("#");
        return {
          ...row,
          record: {
            ...row.record,
            href: `${pathname}?returnTo=${encodeURIComponent(returnTo)}${hash ? `#${hash}` : ""}`,
          },
        };
      }),
    };
  }, [data, filters, calendar]);
  useEffect(() => {
    const query = new URLSearchParams();
    const task = new URLSearchParams(window.location.search).get("task");
    if (task && /^[0-9a-f-]{36}$/i.test(task)) query.set("task", task);
    for (const key of filterKeys)
      if (filters[key]) query.set(key, filters[key]);
    window.history.replaceState(
      window.history.state,
      "",
      `${calendar ? "/calendar" : "/my-tasks"}?${query}`,
    );
  }, [filters, calendar]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    taskWorkspaceApi
      .list(params, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [params, revision]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") revisionFn();
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
  }, [revisionFn]);
  const update = (patch: Partial<Filters>) =>
    setFilters((previous) => ({ ...previous, ...patch, page: "1" }));
  useEffect(() => {
    if (
      data &&
      data.page === Number(filters.page) &&
      data.page > Math.max(1, Math.ceil(data.total / data.limit))
    )
      setFilters((previous) => ({
        ...previous,
        page: String(Math.max(1, Math.ceil(data.total / data.limit))),
      }));
  }, [data, filters.page]);
  const changed = async () => {
    setDialog(null);
    setChosen(null);
    setMove(null);
    window.dispatchEvent(new Event("crm:reminders-changed"));
  };
  const acknowledge = async () => {
    if (!data) return;
    try {
      await taskWorkspaceApi.seen(data.asOf);
      refreshSummary();
      revisionFn();
    } catch (e) {
      setError(message(e));
    }
  };
  const changeZone = async (value: string) => {
    setZoneBusy(true);
    try {
      await remindersApi.displayZone(value);
      setZone(value);
      refreshSummary();
    } catch (e) {
      setError(message(e));
    } finally {
      setZoneBusy(false);
    }
  };
  const today = localInput(new Date(), zone).slice(0, 10);
  const scopes =
    user.role === "ADMIN"
      ? ["MINE", "TEAM", "QUEUE", "SENT", "UNASSIGNED"]
      : user.role === "SHIPPING"
        ? ["MINE", "QUEUE", "SENT"]
        : ["MINE", "SENT"];
  const contextOptions = (
    Object.keys(contextLabels) as ReminderContext[]
  ).filter(
    (context) =>
      user.role === "ADMIN" ||
      context === "PERSONAL" ||
      (user.role === "SHIPPING"
        ? ["SHIPMENT_ORDER", "SHIPMENT", "REPLACEMENT"].includes(context)
        : ["WEBSITE_LEAD", "LEAD", "ORDER"].includes(context)),
  );
  const dialogData = (row: TaskItem): RecordReminders => ({
    items: [],
    suggestions: [],
    policy: data?.policy,
    shippingDone: [],
    total: 0,
    page: 1,
    limit: 20,
    openCount: 0,
    overdueCount: 0,
    types: data?.types ?? [],
    assignments: [],
    timeZone: row.timeZone,
    displayTimeZone: zone,
    canCreate: false,
    recordClosed: false,
  });
  const open = (row: TaskItem, mode: ActionMode) => setDialog({ row, mode });
  const onDrop = (id: string, day: string, hour?: number) => {
    const row = data?.items.find((item) => item.id === id);
    if (!row?.actions.edit) return;
    try {
      const clock =
        hour === undefined
          ? localInput(new Date(row.dueAt), zone).slice(11)
          : `${String(hour).padStart(2, "0")}:00`;
      const dueAt = displayClockToUtc(`${day}T${clock}`, zone);
      if (new Date(dueAt) <= new Date())
        throw Error("Choose a future due time.");
      setMove({ row, dueAt });
    } catch (e) {
      setError(message(e));
    }
  };
  const createSlot = (day: string, hour: number) => {
    try {
      const dueAt = displayClockToUtc(
        `${day}T${String(hour).padStart(2, "0")}:00`,
        zone,
      );
      if (new Date(dueAt) <= new Date())
        throw Error("Choose a future time for the new task.");
      setCreate({ dueAt });
    } catch (e) {
      setError(message(e));
    }
  };
  return (
    <section className="crm-brand-actions space-y-5">
      <ReminderPreferencesDisclosure />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
            Follow-ups & task assignment
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {calendar ? "Calendar" : "My Tasks"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {calendar
              ? "Plan follow-ups and coordinate your next steps."
              : user.role === "SHIPPING"
                ? "Your shared Shipping queue and personal tasks."
                : "Your next follow-ups, assignments, and handoffs in one place."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            Display time zone
            <Select
              aria-label="Task display time zone"
              value={zone}
              disabled={zoneBusy}
              onChange={(e) => void changeZone(e.target.value)}
            >
              {displayZones.map((value) => (
                <option key={value} value={value}>
                  {zoneLabels[value]}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="outline"
            aria-label="Refresh tasks"
            onClick={() => {
              revisionFn();
              refreshSummary();
            }}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          {calendar ? (
            <Button
              variant="outline"
              disabled={loading}
              title="Downloads a snapshot of the selected range, or the next 30 days. Scheduled occurrences only; importing again may duplicate events in your calendar."
              onClick={() => {
                const today = localInput(new Date(), zone).slice(0, 10);
                void downloadReminderFile(
                  "calendar-export.ics",
                  {
                    ...params,
                    from: params.from ?? today,
                    to: params.to ?? shiftTaskDate(today, 30),
                  },
                  "crm-tasks.ics",
                ).catch((e) => setError(message(e)));
              }}
            >
              Export calendar
            </Button>
          ) : null}
          <Button onClick={() => setCreate({})}>
            <Plus className="mr-1 h-4 w-4" />
            Add task
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Overdue", "overdue", "OVERDUE"],
            ["Due today", "today", "TODAY"],
            ["Next 7 days", "upcoming", "UPCOMING"],
            ["New handoffs", "newHandoffs", "NEW"],
          ] as const
        ).map(([title, key, tab]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filters.tab === tab}
            onClick={() => update({ tab })}
            className={cn(
              "rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary",
              filters.tab === tab
                ? "border-primary ring-1 ring-primary/20"
                : "border-border",
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {title}
            </span>
            <span
              className={cn(
                "mt-1 block text-2xl font-semibold",
                key === "overdue" && !!data?.counts.overdue && "text-red-600",
              )}
            >
              {data ? data.counts[key] : "—"}
            </span>
          </button>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="Task scope"
              value={filters.scope}
              onChange={(e) =>
                update({
                  scope: e.target.value,
                  view: filters.view === "queue" ? "agenda" : filters.view,
                  ownerId: "",
                })
              }
              className="w-auto min-w-40"
            >
              {scopes.map((scope) => (
                <option key={scope} value={scope}>
                  {
                    (
                      {
                        MINE: "My tasks",
                        TEAM: "Team tasks",
                        QUEUE: "Shipping queue",
                        SENT: "Sent handoffs",
                        UNASSIGNED: "Unassigned / inactive owners",
                      } as Record<string, string>
                    )[scope]
                  }
                </option>
              ))}
            </Select>
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search tasks"
                className="pl-9"
                placeholder="Search sale/order number, customer, phone, or title"
                value={filters.search}
                onChange={(e) => update({ search: e.target.value })}
              />
            </div>
            {user.role === "ADMIN" && (
              <Select
                aria-label="Task owner"
                className="w-auto min-w-40"
                value={filters.ownerId}
                onChange={(e) =>
                  update({
                    ownerId: e.target.value,
                    scope: "TEAM",
                    view: filters.view === "queue" ? "agenda" : filters.view,
                  })
                }
              >
                <option value="">All owners</option>
                {data?.owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                    {owner.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            <Select
              aria-label="Task record type"
              value={filters.context}
              onChange={(e) => update({ context: e.target.value })}
            >
              <option value="">All record types</option>
              {contextOptions.map((context) => (
                <option key={context} value={context}>
                  {contextLabels[context]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Task type"
              value={filters.typeKey}
              onChange={(e) => update({ typeKey: e.target.value })}
            >
              <option value="">All task types</option>
              {data?.types.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Task priority"
              value={filters.priority}
              onChange={(e) => update({ priority: e.target.value })}
            >
              <option value="">All priorities</option>
              {["HIGH", "MEDIUM", "LOW"].map((priority) => (
                <option key={priority} value={priority}>
                  {label(priority)}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Task status"
              value={filters.status}
              onChange={(e) => update({ status: e.target.value, tab: "ALL" })}
            >
              <option value="">Open & snoozed</option>
              {["OPEN", "SNOOZED", "COMPLETED", "CANCELLED"].map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </Select>
            {(user.role === "SHIPPING" || user.role === "ADMIN") && (
              <Select
                aria-label="Working task filter"
                value={filters.working}
                onChange={(e) => update({ working: e.target.value })}
              >
                <option value="">All working markers</option>
                <option value="true">Working on it: mine</option>
              </Select>
            )}
            {user.role === "ADMIN" && (
              <Select
                aria-label="Snooze flags"
                value={filters.flagged}
                onChange={(event) => update({ flagged: event.target.value })}
              >
                <option value="">All snooze counts</option>
                <option value="true">Repeated snoozes</option>
              </Select>
            )}
            <Select
              aria-label="Handoff filter"
              value={filters.handoff}
              onChange={(event) => update({ handoff: event.target.value })}
            >
              <option value="">All task origins</option>
              <option value="true">Handoffs only</option>
            </Select>
            <Button
              variant="ghost"
              onClick={() =>
                setFilters(
                  initialFilters(new URLSearchParams(), user, calendar, zone),
                )
              }
            >
              Clear filters
            </Button>
          </div>
          {!isTimeline && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted-foreground">
                From
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(e) => update({ from: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Through
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(e) => update({ to: e.target.value })}
                />
              </label>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1 border-t border-border pt-3">
            {(
              [
                ["All", "ALL", "all"],
                ["Overdue", "OVERDUE", "overdue"],
                ["Today", "TODAY", "today"],
                ["Upcoming", "UPCOMING", "upcoming"],
                ["Handed to me", "HANDED", "handed"],
                ["Done", "DONE", "done"],
                ["Cancelled", "CANCELLED", "cancelled"],
              ] as const
            ).map(([title, tab, count]) => (
              <Button
                key={tab}
                size="sm"
                variant={filters.tab === tab ? "default" : "ghost"}
                aria-pressed={filters.tab === tab}
                onClick={() => update({ tab, status: "" })}
              >
                {title}
                <span className="ml-1 text-xs opacity-75">
                  {data?.counts[count] ?? "—"}
                </span>
              </Button>
            ))}
            {(filters.tab === "HANDED" || filters.tab === "NEW") &&
              !!data?.counts.newHandoffs && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void acknowledge()}
                >
                  Mark received tasks seen
                </Button>
              )}
          </div>
        </CardContent>
      </Card>
      {calendar && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex flex-wrap gap-1">
            {views
              .filter((view) => view !== "queue" || user.role !== "SALES")
              .map((view) => (
                <Button
                  key={view}
                  variant={filters.view === view ? "default" : "ghost"}
                  aria-pressed={filters.view === view}
                  size="sm"
                  onClick={() =>
                    update({
                      view,
                      scope:
                        view === "queue"
                          ? "QUEUE"
                          : filters.scope === "QUEUE"
                            ? "MINE"
                            : filters.scope,
                    })
                  }
                >
                  {view === "queue" ? "Shipping queue" : label(view)}
                </Button>
              ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              aria-label="Previous calendar period"
              onClick={() =>
                update({
                  day:
                    filters.view === "month"
                      ? shiftCalendarMonth(filters.day, -1)
                      : shiftTaskDate(
                          filters.day,
                          filters.view === "day" ? -1 : -7,
                        ),
                })
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              aria-label="Calendar date"
              type="date"
              className="w-auto"
              value={filters.day}
              onChange={(e) => {
                if (e.target.value) update({ day: e.target.value });
              }}
            />
            <Button
              size="sm"
              variant="outline"
              aria-label="Next calendar period"
              onClick={() =>
                update({
                  day:
                    filters.view === "month"
                      ? shiftCalendarMonth(filters.day, 1)
                      : shiftTaskDate(
                          filters.day,
                          filters.view === "day" ? 1 : 7,
                        ),
                })
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update({ day: today })}
            >
              Today
            </Button>
            <Select
              aria-label="Calendar colors"
              className="w-auto"
              value={filters.color}
              onChange={(e) => update({ color: e.target.value })}
            >
              <option value="priority">Color by priority</option>
              <option value="type">Color by type</option>
            </Select>
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
        >
          {error}
          <Button variant="ghost" size="sm" onClick={revisionFn}>
            Retry
          </Button>
        </div>
      )}
      {loading && !data && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Loading your tasks…
        </p>
      )}
      {data && isTimeline ? (
        <CalendarBoard
          data={viewData ?? data}
          focusDay={filters.day}
          days={days}
          view={filters.view}
          zone={zone}
          today={today}
          color={filters.color}
          onTask={setSelectedTask}
          onDrop={onDrop}
          onSlot={createSlot}
          onDay={(day) => update({ day, view: "day" })}
        />
      ) : (
        data && (
          <TaskList
            data={viewData ?? data}
            zone={zone}
            today={today}
            user={user}
            open={open}
            changed={changed}
            onError={setError}
            onRecord={(href) => router.push(href)}
          />
        )
      )}
      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {(data.page - 1) * data.limit + 1}–
            {Math.min(data.page * data.limit, data.total)} of {data.total} tasks
            {isTimeline && data.total > data.limit
              ? " · Use Next to see the remaining events; day counts include all matching tasks."
              : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={Number(filters.page) <= 1 || loading}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: String(Number(prev.page) - 1),
                }))
              }
            >
              Previous
            </Button>
            <span>
              Page {filters.page} of {Math.ceil(data.total / data.limit)}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={
                Number(filters.page) * data.limit >= data.total || loading
              }
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: String(Number(prev.page) + 1),
                }))
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {dialog && (
        <ReminderDialog
          key={`${dialog.row.id}:${dialog.mode}`}
          mode={dialog.mode}
          row={dialog.row}
          context={dialog.row.context}
          recordId={recordIdFor(dialog.row)}
          recordLabel={dialog.row.record.customerName}
          data={dialogData(dialog.row)}
          onClose={() => setDialog(null)}
          onSaved={changed}
          onStale={revisionFn}
        />
      )}
      {create && (
        <CreateTaskPicker
          user={user}
          dueAt={create.dueAt}
          onClose={() => setCreate(null)}
          onChosen={(value) => {
            setCreate(null);
            setChosen(value);
          }}
        />
      )}
      {chosen && (
        <ReminderDialog
          mode="create"
          context={chosen.context}
          recordId={chosen.recordId}
          recordLabel={chosen.label}
          data={chosen.data}
          initialDueAt={chosen.dueAt}
          onClose={() => setChosen(null)}
          onSaved={changed}
          onStale={revisionFn}
        />
      )}
      {selectedTask && (
        <TaskModal title="Task details" onClose={() => setSelectedTask(null)}>
          <ReminderRow
            row={selectedTask}
            zone={zone}
            label={
              data?.types.find((type) => type.key === selectedTask.typeKey)
                ?.label ?? label(selectedTask.typeKey)
            }
            history={["COMPLETED", "CANCELLED"].includes(selectedTask.status)}
            open={(mode) => {
              setSelectedTask(null);
              open(selectedTask, mode);
            }}
            work={async () => {
              try {
                await remindersApi.action(selectedTask.id, {
                  action: "WORK",
                  version: selectedTask.version,
                });
                setSelectedTask(null);
                await changed();
              } catch (e) {
                setError(message(e));
                setSelectedTask(null);
                revisionFn();
              }
            }}
            details={
              <div className="space-y-2 text-xs">
                <p className="font-semibold">
                  {selectedTask.record.reference} ·{" "}
                  {selectedTask.record.customerName}
                </p>
                <p>{selectedTask.record.part}</p>
                {selectedTask.record.href && (
                  <Link
                    href={selectedTask.record.href}
                    className="font-semibold text-primary"
                  >
                    Open record →
                  </Link>
                )}
              </div>
            }
          />
        </TaskModal>
      )}
      {move && (
        <TaskModal title="Reschedule task" onClose={() => setMove(null)}>
          <p className="text-sm font-semibold">{move.row.title}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            New due time:{" "}
            {reminderDueLabel(move.dueAt, move.row.timeZone, zone)}
          </p>
          <Button
            className="mt-4"
            onClick={async () => {
              try {
                await taskWorkspaceApi.reschedule(
                  move.row.id,
                  move.row.version,
                  move.dueAt,
                );
                await changed();
              } catch (e) {
                setError(message(e));
                setMove(null);
                revisionFn();
              }
            }}
          >
            Confirm new time
          </Button>
        </TaskModal>
      )}
    </section>
  );
}
function recordIdFor(row: TaskItem) {
  return row.record.id ?? "";
}
function TaskList({
  data,
  zone,
  today,
  user,
  open,
  changed,
  onError,
  onRecord,
}: {
  data: WorkspaceData;
  zone: string;
  today: string;
  user: AuthUser;
  open: (row: TaskItem, mode: ActionMode) => void;
  changed: () => Promise<void>;
  onError: (error: string) => void;
  onRecord: (href: string) => void;
}) {
  const start = useRef<{ x: number; y: number; id: string } | null>(null);
  if (!data.items.length) return <EmptyTasks />;
  const group = (row: TaskItem) =>
    row.status === "COMPLETED"
      ? "Done"
      : row.status === "CANCELLED"
        ? "Cancelled"
        : row.overdue
          ? "Overdue"
          : row.received && user.role === "SALES"
            ? "Handed to me"
            : taskDayLabel(row.displayDay, today);
  return (
    <div className="space-y-5">
      {[
        "Overdue",
        "Handed to me",
        "Today",
        "Tomorrow",
        "Later",
        "Done",
        "Cancelled",
      ].map((name) => {
        const rows = data.items.filter((row) => group(row) === name);
        if (!rows.length) return null;
        return (
          <section key={name} aria-label={`${name} tasks`}>
            <h2
              className={cn(
                "mb-3 text-sm font-semibold",
                name === "Overdue" ? "text-red-600" : "text-muted-foreground",
              )}
            >
              {name} <span className="text-xs">({rows.length})</span>
            </h2>
            <div className="grid gap-3 xl:grid-cols-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  tabIndex={row.record.href ? 0 : undefined}
                  role={row.record.href ? "link" : undefined}
                  aria-label={row.record.href ? `Open ${row.title}` : undefined}
                  className="min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      ["Enter", " "].includes(event.key) &&
                      row.record.href
                    ) {
                      event.preventDefault();
                      onRecord(row.record.href);
                    }
                  }}
                  onClick={(event) => {
                    if (
                      row.record.href &&
                      !(event.target as HTMLElement).closest(
                        "button,a,input,select,textarea,summary",
                      )
                    )
                      onRecord(row.record.href);
                  }}
                  onTouchStart={(event) => {
                    if (
                      (event.target as HTMLElement).closest(
                        "button,a,input,select,textarea",
                      )
                    )
                      return;
                    const touch = event.touches[0];
                    start.current = {
                      x: touch.clientX,
                      y: touch.clientY,
                      id: row.id,
                    };
                  }}
                  onTouchEnd={(event) => {
                    const first = start.current;
                    start.current = null;
                    if (!first || first.id !== row.id) return;
                    const touch = event.changedTouches[0],
                      dx = touch.clientX - first.x,
                      dy = touch.clientY - first.y;
                    if (Math.abs(dx) > 90 && Math.abs(dy) < 50) {
                      if (dx > 0 && row.actions.complete) open(row, "complete");
                      if (dx < 0 && row.actions.snooze) open(row, "snooze");
                    }
                  }}
                >
                  <ReminderRow
                    row={row}
                    zone={zone}
                    label={
                      data.types.find((type) => type.key === row.typeKey)
                        ?.label ?? label(row.typeKey)
                    }
                    history={["COMPLETED", "CANCELLED"].includes(row.status)}
                    open={(mode) => open(row, mode)}
                    work={async () => {
                      try {
                        await remindersApi.action(row.id, {
                          action: "WORK",
                          version: row.version,
                        });
                        await changed();
                      } catch (e) {
                        onError(message(e));
                      }
                    }}
                    details={
                      <div className="space-y-1.5 rounded-lg bg-secondary/30 p-3 text-xs">
                        {row.overdue && (
                          <Badge variant="danger">
                            Overdue{" "}
                            {Math.max(
                              1,
                              Math.floor(
                                (Date.now() - Date.parse(row.dueAt)) / 3600000,
                              ),
                            )}
                            h
                          </Badge>
                        )}
                        {row.snoozeCount > 0 && (
                          <p className="text-muted-foreground">
                            Snoozed {row.snoozeCount}{" "}
                            {row.snoozeCount === 1 ? "time" : "times"}
                          </p>
                        )}
                        <p className="font-semibold">
                          {row.record.reference} · {row.record.customerName}
                        </p>
                        <p className="text-muted-foreground">
                          {[row.record.vehicle, row.record.part]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p>
                          {[
                            row.record.status ? label(row.record.status) : null,
                            row.record.phone,
                            row.record.state,
                            row.record.carrier,
                            row.record.tracking,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {row.record.amount && (
                          <p className="font-semibold">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: row.record.currency,
                            }).format(Number(row.record.amount))}
                          </p>
                        )}
                        {row.record.href ? (
                          <Link
                            href={row.record.href}
                            className="inline-flex items-center gap-1 font-semibold text-primary"
                          >
                            Open record
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          row.actions.edit && (
                            <button
                              className="font-semibold text-primary"
                              onClick={() => open(row, "edit")}
                            >
                              Open personal task
                            </button>
                          )
                        )}
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
function EmptyTasks() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h2 className="font-semibold">No tasks match these filters</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Adjust the filters or add your next follow-up.
      </p>
    </div>
  );
}
function TaskModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-label={title}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl backdrop:bg-slate-950/40"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Close task dialog"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
function CreateTaskPicker({
  user,
  dueAt,
  onClose,
  onChosen,
}: {
  user: AuthUser;
  dueAt?: string;
  onClose: () => void;
  onChosen: (value: {
    context: ReminderContext;
    recordId: string;
    label: string;
    data: RecordReminders;
    dueAt?: string;
  }) => void;
}) {
  const [context, setContext] = useState<ReminderContext>("PERSONAL"),
    [search, setSearch] = useState(""),
    [rows, setRows] = useState<TaskRecordChoice[]>([]),
    [id, setId] = useState(""),
    [data, setData] = useState<RecordReminders | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(false);
  const options = (Object.keys(contextLabels) as ReminderContext[]).filter(
    (value) =>
      user.role === "ADMIN" ||
      value === "PERSONAL" ||
      (user.role === "SHIPPING"
        ? ["SHIPMENT_ORDER", "SHIPMENT", "REPLACEMENT"].includes(value)
        : ["WEBSITE_LEAD", "LEAD", "ORDER"].includes(value)),
  );
  useEffect(() => {
    const controller = new AbortController();
    setRows([]);
    setError(null);
    if (context === "PERSONAL") return () => controller.abort();
    setLoading(true);
    const timer = window.setTimeout(() => {
      taskWorkspaceApi
        .records(context, search, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setRows(value);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(message(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [context, search]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    if (context !== "PERSONAL" && !id) return () => controller.abort();
    setLoading(true);
    remindersApi
      .record(context, id, 1, false, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [context, id]);
  return (
    <TaskModal title="Add task" onClose={onClose}>
      <div className="space-y-4">
        <label className="block space-y-1 text-sm font-medium">
          Link to
          <Select
            value={context}
            onChange={(e) => {
              setContext(e.target.value as ReminderContext);
              setId("");
              setData(null);
              setSearch("");
            }}
          >
            {options.map((value) => (
              <option key={value} value={value}>
                {contextLabels[value]}
              </option>
            ))}
          </Select>
        </label>
        {context !== "PERSONAL" && (
          <>
            <Input
              aria-label="Search linked records"
              placeholder="Find a customer or sale/order number"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setId("");
              }}
            />
            <label className="block space-y-1 text-sm font-medium">
              Record
              <Select value={id} onChange={(e) => setId(e.target.value)}>
                <option value="">Choose a record</option>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </Select>
            </label>
            {!rows.length && !loading && (
              <p className="text-xs text-muted-foreground">
                No eligible records found.
              </p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button
          disabled={!data || !data.canCreate || loading}
          onClick={() => {
            if (data)
              onChosen({
                context,
                recordId: id,
                label:
                  context === "PERSONAL"
                    ? "Personal task"
                    : (rows.find((row) => row.id === id)?.label ?? "Follow-up"),
                data,
                dueAt,
              });
          }}
        >
          {loading ? "Loading…" : "Continue"}
        </Button>
      </div>
    </TaskModal>
  );
}
function CalendarBoard({
  data,
  focusDay,
  days,
  view,
  zone,
  today,
  color,
  onTask,
  onDrop,
  onSlot,
  onDay,
}: {
  data: WorkspaceData;
  focusDay: string;
  days: string[];
  view: string;
  zone: string;
  today: string;
  color: string;
  onTask: (row: TaskItem) => void;
  onDrop: (id: string, day: string, hour?: number) => void;
  onSlot: (day: string, hour: number) => void;
  onDay: (day: string) => void;
}) {
  const palette = [
    "border-l-blue-500",
    "border-l-violet-500",
    "border-l-teal-500",
    "border-l-orange-500",
  ];
  const event = (row: TaskItem) => (
    <button
      key={row.id}
      draggable={row.actions.edit}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", row.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onTask(row);
      }}
      className={cn(
        "block w-full rounded-lg border border-border border-l-4 bg-card p-2 text-left text-xs shadow-sm hover:ring-1 hover:ring-primary",
        color === "type"
          ? palette[
              Array.from(row.typeKey).reduce((n, c) => n + c.charCodeAt(0), 0) %
                palette.length
            ]
          : row.priority === "HIGH"
            ? "border-l-red-500"
            : row.priority === "MEDIUM"
              ? "border-l-amber-400"
              : "border-l-slate-300",
      )}
    >
      <span className="flex items-start gap-1">
        {row.actions.edit && (
          <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="line-clamp-2 font-semibold">{row.title}</span>
      </span>
      <span className="mt-1 block text-muted-foreground">
        {new Intl.DateTimeFormat("en-US", {
          timeZone: zone,
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(row.dueAt))}{" "}
        · {row.record.reference}
      </span>
    </button>
  );
  const dropProps = (day: string, hour?: number) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      onDrop(e.dataTransfer.getData("text/plain"), day, hour);
    },
  });
  if (view === "month")
    return (
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <div className="grid min-w-[700px] grid-cols-7">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="border-b border-border p-2 text-center text-xs font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {days.map((day) => {
            const items = data.items.filter((row) => row.displayDay === day);
            return (
              <div
                key={day}
                {...dropProps(day)}
                className={cn(
                  "min-h-36 space-y-1.5 border-b border-r border-border p-2",
                  day === today && "bg-primary/5",
                )}
              >
                <button
                  className="flex w-full justify-between text-xs font-semibold"
                  onClick={() => onDay(day)}
                >
                  <span>
                    {Number(day.slice(-2))}{" "}
                    <span className="text-muted-foreground">
                      {day.slice(0, 7) !== focusDay.slice(0, 7)
                        ? new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            timeZone: "UTC",
                          }).format(new Date(`${day}T12:00Z`))
                        : ""}
                    </span>
                  </span>
                  <span>{data.dayCounts[day] ?? 0}</span>
                </button>
                {items.slice(0, 3).map(event)}
                {items.length > 3 && (
                  <button
                    className="text-xs font-medium text-primary"
                    onClick={() => onDay(day)}
                  >
                    View {data.dayCounts[day]} tasks
                  </button>
                )}
                <button
                  aria-label={`Add task on ${day}`}
                  className="text-xs text-muted-foreground hover:text-primary"
                  onClick={() => onSlot(day, 10)}
                >
                  + Add
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  return (
    <div className="max-h-[75dvh] overflow-auto rounded-2xl border border-border bg-card">
      <div style={{ minWidth: view === "day" ? 300 : 900 }}>
        <div
          className="sticky top-0 z-10 grid border-b border-border bg-card"
          style={{
            gridTemplateColumns: `60px repeat(${days.length},minmax(0,1fr))`,
          }}
        >
          <div className="p-2 text-xs text-muted-foreground">
            {zoneLabels[zone]}
          </div>
          {days.map((day) => (
            <button
              key={day}
              onClick={() => onDay(day)}
              className={cn(
                "p-3 text-center text-xs font-semibold",
                day === today && "bg-primary/10 text-primary",
              )}
            >
              {new Intl.DateTimeFormat("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              }).format(new Date(`${day}T12:00Z`))}
              <span className="ml-1 text-muted-foreground">
                ({data.dayCounts[day] ?? 0})
              </span>
            </button>
          ))}
        </div>
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={hour}
            className="grid"
            style={{
              gridTemplateColumns: `60px repeat(${days.length},minmax(0,1fr))`,
            }}
          >
            <div className="border-b border-border p-2 text-right text-[10px] text-muted-foreground">
              {String(hour).padStart(2, "0")}:00
            </div>
            {days.map((day) => (
              <div
                key={day}
                {...dropProps(day, hour)}
                className="min-h-20 space-y-1 border-b border-l border-border/70 p-1"
              >
                <button
                  aria-label={`Add task ${day} ${hour}:00`}
                  className="block w-full text-right text-[10px] text-muted-foreground opacity-50 hover:text-primary hover:opacity-100"
                  onClick={() => onSlot(day, hour)}
                >
                  +
                </button>
                {data.items
                  .filter(
                    (row) =>
                      row.displayDay === day &&
                      Number(
                        localInput(new Date(row.dueAt), zone).slice(11, 13),
                      ) === hour,
                  )
                  .map(event)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
