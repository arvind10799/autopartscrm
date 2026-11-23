"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  reminderNotificationsApi,
  type ReminderAlert,
} from "./reminder-notifications-api";
type OpenAlert = {
  id: string;
  action?: "COMPLETE" | "SNOOZE" | "WORK";
  minutes?: 15 | 60;
};
export function openReminderAlert(detail: OpenAlert) {
  window.dispatchEvent(new CustomEvent("crm:open-reminder", { detail }));
}
export function ReminderAlertDialog() {
  const query = useSearchParams(),
    pathname = usePathname(),
    router = useRouter();
  const [selected, setSelected] = useState<OpenAlert | null>(null),
    [data, setData] = useState<ReminderAlert | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const deepTask = query.get("task");
  useEffect(() => {
    if (deepTask && /^[0-9a-f-]{36}$/i.test(deepTask))
      setSelected({ id: deepTask });
    else {
      ref.current?.close();
      setSelected(null);
    }
  }, [deepTask]);
  useEffect(() => {
    const open = (event: Event) =>
      setSelected((event as CustomEvent<OpenAlert>).detail);
    window.addEventListener("crm:open-reminder", open);
    return () => window.removeEventListener("crm:open-reminder", open);
  }, []);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setError("");
    setData(null);
    setNote("");
    ref.current?.showModal();
    void reminderNotificationsApi
      .alert(selected.id)
      .then((v) => {
        if (active) setData(v);
      })
      .catch(() => {
        if (active)
          setError("This task is unavailable or your access has changed.");
      });
    return () => {
      active = false;
    };
  }, [selected]);
  const close = () => {
    if (busy) return;
    ref.current?.close();
    setSelected(null);
    if (query.has("task")) {
      const next = new URLSearchParams(query.toString());
      next.delete("task");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
        scroll: false,
      });
    }
  };
  const act = async (
    action: "COMPLETE" | "SNOOZE" | "WORK",
    minutes?: 15 | 60,
  ) => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await reminderNotificationsApi.action(data.item.id, {
        action,
        version: data.item.version,
        ...(minutes ? { snoozeMinutes: minutes } : {}),
        ...(action === "COMPLETE" && note.trim()
          ? { completionNote: note.trim() }
          : {}),
      });
      setData(await reminderNotificationsApi.alert(data.item.id));
      setNote("");
    } catch {
      setError(
        "The task changed or could not be updated. Close and reopen it to refresh.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="crm-brand-actions crm-reminder-ui w-[calc(100%-2rem)] max-w-lg rounded-2xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {data?.item.title ?? "Reminder"}
        </h2>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={close}
          aria-label="Close reminder"
        >
          ✕
        </Button>
      </div>
      {error ? (
        <p role="alert" className="my-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {!data && !error ? <p className="py-5 text-sm">Loading task…</p> : null}
      {data ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.item.status} · {data.item.priority.toLowerCase()} priority ·{" "}
            {data.item.owner?.name ?? "Shipping queue"}
          </p>
          <p className="mt-2 text-sm">
            {new Intl.DateTimeFormat("en-US", {
              timeZone: data.item.timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(data.item.dueAt))}{" "}
            · {data.item.timeZone}
          </p>
          {data.displayTimeZone !== data.item.timeZone ? (
            <p className="text-sm text-muted-foreground">
              Your time:{" "}
              {new Intl.DateTimeFormat("en-US", {
                timeZone: data.displayTimeZone,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(data.item.dueAt))}
            </p>
          ) : null}
          {data.item.note ? (
            <p className="my-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
              {data.item.note}
            </p>
          ) : null}
          {data.item.actions.complete ? (
            <label className="mt-4 block text-sm">
              Completion note (optional)
              <textarea
                aria-label="Reminder completion note"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-lg border bg-background p-2"
              />
            </label>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {data.item.actions.complete ? (
              <Button disabled={busy} onClick={() => void act("COMPLETE")}>
                Complete
              </Button>
            ) : null}
            {data.item.actions.snooze ? (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act("SNOOZE", 15)}
                >
                  Snooze 15 min
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act("SNOOZE", 60)}
                >
                  Snooze 1 hour
                </Button>
              </>
            ) : null}
            {data.item.actions.work ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void act("WORK")}
              >
                {data.item.workingBy ? "Working on it" : "Work on this"}
              </Button>
            ) : null}
            {data.href ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  ref.current?.close();
                  setSelected(null);
                  router.push(data.href!);
                }}
              >
                Open record
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
