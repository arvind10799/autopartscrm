"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ReminderDialog } from "./RemindersPanel";
import { remindersApi } from "./reminders-api";
import type { RecordReminders } from "./reminder.schema";
export function OrderReminderShortcut({
  orderId,
  agentId,
  label,
}: {
  orderId: string;
  agentId: string;
  label: string;
}) {
  const user = useAuthStore((s) => s.user),
    [data, setData] = useState<RecordReminders | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (
    !user ||
    !(
      user.role === "ADMIN" ||
      (user.role === "SALES" && user.userId === agentId)
    )
  )
    return null;
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await remindersApi.record("ORDER", orderId);
      if (r.canCreate) setData(r);
      else setError("This order is closed.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load reminder form.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="mt-1 block">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void load();
        }}
      >
        {busy ? "Loading…" : "Add reminder"}
      </Button>
      {error ? (
        <span role="alert" className="block text-xs text-red-600">
          {error}
        </span>
      ) : null}
      {data ? (
        <ReminderDialog
          mode="create"
          data={data}
          context="ORDER"
          recordId={orderId}
          recordLabel={label}
          onClose={() => setData(null)}
          onSaved={async () => {
            setData(null);
            window.dispatchEvent(new Event("crm:reminders-changed"));
          }}
          onStale={() => {}}
        />
      ) : null}
    </span>
  );
}
