"use client";
import { ReminderPolicySettings } from "./ReminderPolicySettings";
import { ReminderAutomationSettings } from "./ReminderAutomationSettings";
import { useEffect, useState } from "react";
import { BellRing, Clock3, UserRound, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usersApi } from "@/features/users/api/users-api";
import { displayZones } from "./reminder.schema";
import {
  reminderNotificationsApi,
  type ReminderPreferences,
  type ReminderSettings,
} from "./reminder-notifications-api";
import { enableReminderPush, detachReminderPush } from "./reminder-push";
const clock = (v: number) =>
  `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
const minute = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
const zoneNames = ["Pacific", "Mountain", "Central", "Eastern"];
export function ReminderPreferencesDisclosure() {
  const [open, setOpen] = useState(false);
  return (
    <details
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-xl border bg-card p-3"
    >
      <summary className="cursor-pointer text-sm font-medium">
        Reminder preferences & notifications
      </summary>
      {open ? (
        <div className="mt-3">
          <ReminderNotificationSettings />
        </div>
      ) : null}
    </details>
  );
}
export function ReminderNotificationSettings({ userId }: { userId?: string }) {
  const me = useAuthStore((s) => s.user),
    [value, setValue] = useState<ReminderPreferences | null>(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false),
    [push, setPush] = useState(""),
    [key, setKey] = useState<string | null>(null);
  const own = !userId || userId === me?.userId;
  useEffect(() => {
    let active = true;
    setValue(null);
    setError("");
    setSaved("");
    void reminderNotificationsApi
      .preferences(userId)
      .then((v) => {
        if (active) setValue(v);
      })
      .catch(() => {
        if (active) setError("Unable to load reminder preferences.");
      });
    return () => {
      active = false;
    };
  }, [userId]);
  useEffect(() => {
    if (!own) return;
    let active = true;
    void reminderNotificationsApi
      .configuration()
      .then(async (c) => {
        if (!active) return;
        setKey(c.publicKey);
        const registration =
          "serviceWorker" in navigator
            ? await navigator.serviceWorker.getRegistration("/")
            : null;
        const subscription = await registration?.pushManager?.getSubscription();
        if (active)
          setPush(
            subscription
              ? "Enabled on this browser"
              : c.publicKey
                ? "Not enabled on this browser"
                : "Browser push is not configured yet",
          );
      })
      .catch(() => setPush("Push status unavailable"));
    return () => {
      active = false;
    };
  }, [own]);
  return (
    <section
      className="crm-brand-actions crm-reminder-ui crm-reminder-preferences rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
      aria-label="Reminder preferences"
    >
      <h3 className="font-semibold">
        {own ? "Your reminder preferences" : "User reminder preferences"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Working hours use the selected display time zone. High-priority alerts
        and Admin escalations bypass quiet hours.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {saved}
        </p>
      ) : null}
      {value ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setSaved("");
            if (value.workingStartMinute === value.workingEndMinute) {
              setError("Start and end times must differ.");
              return;
            }
            setBusy(true);
            void reminderNotificationsApi
              .savePreferences(value, userId)
              .then(() => setSaved("Reminder preferences saved."))
              .catch(() => setError("Unable to save reminder preferences."))
              .finally(() => setBusy(false));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Display time zone
              <Select
                aria-label="Preference display time zone"
                value={value.displayTimeZone}
                onChange={(e) =>
                  setValue({
                    ...value,
                    displayTimeZone: e.target
                      .value as ReminderPreferences["displayTimeZone"],
                  })
                }
              >
                {displayZones.map((z, i) => (
                  <option key={z} value={z}>
                    {zoneNames[i]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              Shift starts
              <Input
                aria-label="Shift starts"
                type="time"
                required
                value={clock(value.workingStartMinute)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    workingStartMinute: minute(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-sm">
              Shift ends
              <Input
                aria-label="Shift ends"
                type="time"
                required
                value={clock(value.workingEndMinute)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    workingEndMinute: minute(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.dailyDigestEnabled}
              onChange={(e) =>
                setValue({ ...value, dailyDigestEnabled: e.target.checked })
              }
            />
            Daily email digest at shift start
          </label>
          <Button disabled={busy} type="submit">
            {busy ? "Saving…" : "Save preferences"}
          </Button>
        </form>
      ) : !error ? (
        <p className="mt-3 text-sm">Loading preferences…</p>
      ) : null}
      {own ? (
        <div className="mt-5 border-t pt-4">
          <p className="text-sm">{push}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            On iPhone, add CRM to the Home Screen and open it there to enable
            push.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy || !key}
              onClick={() => {
                if (!me || !key) return;
                setBusy(true);
                setError("");
                void enableReminderPush(me.userId, key)
                  .then(() => {
                    try {
                      localStorage.setItem(
                        "crm-reminder-push-owner",
                        me.userId,
                      );
                    } catch {}
                    setPush("Enabled on this browser");
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
              Enable browser notifications
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void detachReminderPush()
                  .then(() => setPush("Disabled on this browser"))
                  .catch(() =>
                    setError(
                      "Browser notifications were detached; server cleanup may need a retry.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Disable on this browser
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
export function ReminderAdminSettings() {
  const [section, setSection] = useState("delivery");
  const [value, setValue] = useState<ReminderSettings | null>(null),
    [users, setUsers] = useState<Array<{ id: string; name: string }>>([]),
    [userId, setUserId] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([reminderNotificationsApi.settings(), usersApi.list()])
      .then(([s, u]) => {
        if (active) {
          setValue(s);
          setUsers(u);
        }
      })
      .catch(() => {
        if (active) setError("Unable to load reminder settings.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="crm-brand-actions crm-reminder-ui crm-reminder-settings space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reminder settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage delivery, user preferences, scheduling, and follow-up rules.
        </p>
      </div>
      <div
        role="tablist"
        aria-label="Reminder settings sections"
        className="crm-reminder-settings-nav flex gap-6 overflow-x-auto border-b border-border"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const tabs = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="tab"]',
            ),
          );
          const index = tabs.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    tabs.length) %
                  tabs.length;
          tabs[next]?.click();
          tabs[next]?.focus();
        }}
      >
        {(
          [
            ["delivery", "Delivery & alerts", BellRing],
            ["preferences", "User preferences", UserRound],
            ["scheduling", "Scheduling", Clock3],
            ["automation", "Suggestions & repeats", Workflow],
          ] as const
        ).map(([key, title, Icon]) => (
          <button
            key={key}
            id={`reminder-settings-tab-${key}`}
            role="tab"
            type="button"
            aria-selected={section === key}
            aria-controls={`reminder-settings-panel-${key}`}
            tabIndex={section === key ? 0 : -1}
            onClick={() => setSection(key)}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] border-transparent py-3 text-xs font-semibold"
          >
            <Icon className="h-4 w-4" />
            {title}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="reminder-settings-panel-delivery"
        aria-labelledby="reminder-settings-tab-delivery"
        hidden={section !== "delivery"}
      >
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold tracking-tight">
            Reminder notifications
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Delivery status and alert timing for your team.
          </p>
          {error ? (
            <p role="alert" className="my-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="my-3 text-sm text-emerald-700">
              {saved}
            </p>
          ) : null}
          {value ? (
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                setSaved("");
                const {
                  deliveryEnabled,
                  secondAlertMinutes,
                  escalationMinutes,
                  workingMarkerMinutes,
                  snoozeFlagCount,
                } = value;
                void reminderNotificationsApi
                  .saveSettings({
                    deliveryEnabled,
                    secondAlertMinutes,
                    escalationMinutes,
                    workingMarkerMinutes,
                    snoozeFlagCount,
                  })
                  .then(() => setSaved("Notification settings saved."))
                  .catch(() =>
                    setError(
                      "Unable to save notification settings. Check the allowed ranges.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  [
                    "Server delivery",
                    value.serverEnabled ? "Enabled" : "Disabled",
                    value.serverEnabled,
                  ],
                  [
                    "Worker",
                    value.workerRecent ? "Running" : "No recent check-in",
                    value.workerRecent,
                  ],
                  [
                    "Browser push",
                    value.pushConfigured ? "Configured" : "Setup needed",
                    value.pushConfigured,
                  ],
                  [
                    "SMTP",
                    value.emailConfigured ? "Configured" : "Setup needed",
                    value.emailConfigured,
                  ],
                ].map(([title, status, ready]) => (
                  <div
                    key={String(title)}
                    className="min-w-0 rounded-xl border border-border bg-secondary/20 p-4"
                  >
                    <p className="text-[11px] text-muted-foreground">{title}</p>
                    <p className="mt-2 flex items-center gap-2 text-xs font-semibold">
                      <span
                        className={
                          ready
                            ? "h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500"
                            : "h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
                        }
                      />
                      {status}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                <p>
                  {value.workerRecent ? "Worker settings" : "API settings"} ·
                  Staff reminder email{" "}
                  {value.emailEnabled === undefined
                    ? "status unknown"
                    : value.emailEnabled
                      ? "enabled"
                      : "disabled"}
                </p>
                {value.workerLastSeenAt && (
                  <p>
                    Last worker check-in{" "}
                    {new Date(value.workerLastSeenAt).toLocaleString()}.
                  </p>
                )}
                {value.checkedAt && (
                  <p>
                    Status checked {new Date(value.checkedAt).toLocaleString()}.
                  </p>
                )}
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 p-4 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={value.deliveryEnabled}
                  onChange={(e) =>
                    setValue({ ...value, deliveryEnabled: e.target.checked })
                  }
                />
                Enable reminder delivery
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    [
                      "secondAlertMinutes",
                      "Second alert after (minutes)",
                      15,
                      240,
                    ],
                    [
                      "escalationMinutes",
                      "Escalate to Admin after (minutes)",
                      30,
                      1440,
                    ],
                    [
                      "workingMarkerMinutes",
                      "Working marker duration (minutes)",
                      30,
                      480,
                    ],
                    ["snoozeFlagCount", "Flag after this many snoozes", 1, 10],
                  ] as const
                ).map(([field, label, min, max]) => (
                  <label className="text-sm" key={field}>
                    {label}
                    <Input
                      aria-label={label}
                      type="number"
                      min={min}
                      max={max}
                      required={field === "workingMarkerMinutes"}
                      placeholder="Off"
                      value={value[field] ?? ""}
                      onChange={(e) =>
                        setValue({
                          ...value,
                          [field]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                    {field !== "workingMarkerMinutes" ? (
                      <span className="text-xs text-muted-foreground">
                        Leave blank to switch off.
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="rounded-md bg-secondary px-2.5 py-1.5">
                  {value.pending} pending / processing
                </span>
                <span className="rounded-md bg-secondary px-2.5 py-1.5">
                  {value.failed} failed deliveries
                </span>
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save notification settings"}
              </Button>
            </form>
          ) : !error ? (
            <p className="mt-3 text-sm">Loading settings…</p>
          ) : null}
        </section>
      </div>
      <div
        role="tabpanel"
        id="reminder-settings-panel-preferences"
        aria-labelledby="reminder-settings-tab-preferences"
        hidden={section !== "preferences"}
        className="space-y-4"
      >
        <label className="block max-w-sm text-sm">
          User preferences
          <Select
            aria-label="Reminder preference user"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">My preferences</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </label>
        <ReminderNotificationSettings
          key={userId}
          userId={userId || undefined}
        />
      </div>
      <div
        role="tabpanel"
        id="reminder-settings-panel-scheduling"
        aria-labelledby="reminder-settings-tab-scheduling"
        hidden={section !== "scheduling"}
      >
        <ReminderPolicySettings />
      </div>
      <div
        role="tabpanel"
        id="reminder-settings-panel-automation"
        aria-labelledby="reminder-settings-tab-automation"
        hidden={section !== "automation"}
      >
        <ReminderAutomationSettings />
      </div>
    </div>
  );
}
