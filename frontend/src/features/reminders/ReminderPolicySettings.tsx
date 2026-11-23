"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  reminderPhase6Api,
  reminderPolicySchema,
  type ReminderPolicy,
} from "./reminder-phase6-api";
import { displayZones, zoneLabels } from "./reminder.schema";
const clock = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export function ReminderPolicySettings() {
  const [policy, setPolicy] = useState<ReminderPolicy | null>(null),
    [defaults, setDefaults] = useState<Record<string, string>>({}),
    [snoozes, setSnoozes] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void reminderPhase6Api
      .policy()
      .then((p) => {
        if (active) {
          setPolicy(reminderPolicySchema.parse(p));
          setDefaults(p.defaultStateTimeZones ?? {});
          setSnoozes(p.snoozeMinutes.join(", "));
        }
      })
      .catch(() => {
        if (active) setError("Unable to load reminder scheduling settings.");
      });
    return () => {
      active = false;
    };
  }, []);
  if (!policy)
    return (
      <p role={error ? "alert" : "status"} className="text-sm">
        {error || "Loading scheduling settings…"}
      </p>
    );
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Scheduling preferences</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Existing tasks retain their saved time zone until rescheduled or their
        linked record is updated. New tasks and record updates use the current
        state mapping.
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setSaved(false);
          setError("");
          const input = reminderPolicySchema.safeParse({
            ...policy,
            snoozeMinutes: snoozes.split(",").map((s) => Number(s.trim())),
          });
          if (
            !input.success ||
            new Set(input.data?.snoozeMinutes).size !==
              input.data?.snoozeMinutes.length
          ) {
            setError(
              "Enter 1–8 different whole-minute snooze choices, each from 1 to 43,200.",
            );
            setBusy(false);
            return;
          }
          void reminderPhase6Api
            .savePolicy(input.data)
            .then((p) => {
              setPolicy(p);
              setSnoozes(p.snoozeMinutes.join(", "));
              setSaved(true);
              window.dispatchEvent(new Event("crm:reminders-changed"));
            })
            .catch((e) =>
              setError(
                e instanceof Error ? e.message : "Unable to save settings.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm">
            Snooze choices (minutes, separated by commas)
            <Input
              aria-label="Snooze choices in minutes"
              value={snoozes}
              onChange={(e) => setSnoozes(e.target.value)}
              required
            />
            <span className="text-xs text-muted-foreground">
              15 and 60 minute alert shortcuts continue to work; custom time
              remains available.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={policy.callingWindowEnabled}
              onChange={(e) =>
                setPolicy({ ...policy, callingWindowEnabled: e.target.checked })
              }
            />
            Warn for Call/Text outside the customer calling window
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Calling window starts
              <Input
                aria-label="Calling window starts"
                type="time"
                value={clock(policy.callingStartMinute)}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    callingStartMinute: minutes(e.target.value),
                  })
                }
                required
              />
            </label>
            <label className="text-sm">
              Calling window ends
              <Input
                aria-label="Calling window ends"
                type="time"
                value={clock(policy.callingEndMinute)}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    callingEndMinute: minutes(e.target.value),
                  })
                }
                required
              />
            </label>
          </div>
          <label className="block text-sm">
            Default display time zone
            <Select
              aria-label="Default reminder display zone"
              value={policy.defaultDisplayTimeZone}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  defaultDisplayTimeZone: e.target
                    .value as ReminderPolicy["defaultDisplayTimeZone"],
                })
              }
            >
              {displayZones.map((z) => (
                <option key={z} value={z}>
                  {zoneLabels[z]}
                </option>
              ))}
            </Select>
            <span className="text-xs text-muted-foreground">
              Applies to users who have not chosen a preference. Existing
              preferences are preserved.
            </span>
          </label>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Customer state time zones
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {Object.entries(defaults)
                .sort()
                .map(([state, zone]) => (
                  <label className="text-xs" key={state}>
                    {state}
                    <Select
                      aria-label={`${state} reminder time zone`}
                      value={policy.stateTimeZones[state] ?? ""}
                      onChange={(e) => {
                        const map = { ...policy.stateTimeZones };
                        if (e.target.value)
                          map[state] = e.target
                            .value as ReminderPolicy["stateTimeZones"][string];
                        else delete map[state];
                        setPolicy({ ...policy, stateTimeZones: map });
                      }}
                    >
                      <option value="">
                        Default · {zoneLabels[zone] ?? zone}
                      </option>
                      {[...displayZones, "America/Phoenix"].map((z) => (
                        <option key={z} value={z}>
                          {zoneLabels[z] ?? z}
                        </option>
                      ))}
                    </Select>
                  </label>
                ))}
            </div>
          </details>
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm text-emerald-700">
            Scheduling settings saved.
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save scheduling settings"}
        </Button>
      </form>
    </section>
  );
}
