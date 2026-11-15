"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { reminderNotificationsApi } from "./reminder-notifications-api";
import {
  bindReminderDevice,
  enableReminderPush,
  detachReminderPush,
} from "./reminder-push";

export function ReminderPushPrompt({ userId }: { userId: string }) {
  const [key, setKey] = useState<string | null>(null),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      const config = await reminderNotificationsApi.configuration();
      if (!active || !config.enabled || !config.publicKey) return;
      setKey(config.publicKey);
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        let bound: string | null = null;
        try {
          bound = localStorage.getItem("crm-reminder-push-owner");
        } catch {}
        if (
          subscription &&
          bound === userId &&
          Notification.permission === "granted"
        ) {
          await reminderNotificationsApi.subscribe(subscription.toJSON());
          await bindReminderDevice(userId);
          return;
        }
        if (subscription) await detachReminderPush();
      }
      let dismissed = false;
      try {
        dismissed =
          localStorage.getItem(`crm-reminder-push-dismissed:${userId}`) ===
          "true";
      } catch {}
      if (active && !dismissed) setVisible(true);
    })().catch(() => {});
    const receive = (event: MessageEvent) => {
      if (event.data?.type === "crm:reminder-arrived")
        window.dispatchEvent(new Event("crm:notifications-changed"));
    };
    navigator.serviceWorker?.addEventListener("message", receive);
    return () => {
      active = false;
      navigator.serviceWorker?.removeEventListener("message", receive);
    };
  }, [userId]);
  if (!visible || !key) return null;
  return (
    <aside
      aria-label="Enable reminder notifications"
      className="mx-3 mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-slate-900 sm:mx-6 dark:border-blue-900 dark:bg-slate-900 dark:text-white"
    >
      <p className="font-semibold">Keep up with your reminders</p>
      <p className="mt-1 text-sm">
        Enable browser alerts for tasks and handoffs. On iPhone, first add CRM
        to the Home Screen and open it there.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            void enableReminderPush(userId, key)
              .then(() => {
                try {
                  localStorage.setItem("crm-reminder-push-owner", userId);
                } catch {}
                setVisible(false);
              })
              .catch((e) =>
                setError(
                  e instanceof Error
                    ? e.message
                    : "Unable to enable notifications.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Enabling…" : "Enable notifications"}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            try {
              localStorage.setItem(
                `crm-reminder-push-dismissed:${userId}`,
                "true",
              );
            } catch {}
            setVisible(false);
          }}
        >
          Later
        </Button>
      </div>
    </aside>
  );
}
