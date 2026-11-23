"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  reminderAutomationApi,
  type AutomationSettings,
} from "./reminder-automation-api";
export function ReminderAutomationSettings() {
  const [data, setData] = useState<AutomationSettings | null>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [key, setKey] = useState("USER_"),
    [label, setLabel] = useState(""),
    [roles, setRoles] = useState<string[]>(["ADMIN", "SALES"]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void reminderAutomationApi
      .settings()
      .then((v) => {
        if (active) setData(v);
      })
      .catch(() => {
        if (active) setError("Unable to load automation settings.");
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const saved = () => {
    setSuccess("Automation settings saved.");
    setError("");
    setRevision((v) => v + 1);
    window.dispatchEvent(new Event("crm:reminders-changed"));
  };
  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
      aria-label="Reminder automation settings"
    >
      <h2 className="text-lg font-semibold">
        Suggestions & repeating reminders
      </h2>
      <p className="text-sm text-muted-foreground">
        Suggestions require user acceptance. Changes to rules affect available
        suggestions; existing repeating schedules retain their chosen settings.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-sm text-emerald-700">
          {success}
        </p>
      ) : null}
      {!data ? (
        <p className="text-sm">Loading automation…</p>
      ) : (
        <>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">
              Reminder types ({data.types.length})
            </summary>
            <div className="mt-3 space-y-3">
              {data.types.map((type) => (
                <TypeEditor
                  key={JSON.stringify(type)}
                  type={type}
                  onSaved={saved}
                  onError={setError}
                />
              ))}
              <form
                className="space-y-3 rounded-lg border border-dashed p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  void reminderAutomationApi
                    .createType({ key, label, allowedRoles: roles })
                    .then(() => {
                      setKey("USER_");
                      setLabel("");
                      saved();
                    })
                    .catch((e) =>
                      setError(
                        e instanceof Error ? e.message : "Unable to add type.",
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                <h3 className="font-medium">Add reminder type</h3>
                <label className="block text-sm">
                  Stable type key
                  <Input
                    aria-label="New reminder type key"
                    value={key}
                    required
                    pattern="USER_[A-Z0-9_]+"
                    maxLength={50}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                  />
                </label>
                <label className="block text-sm">
                  Display name
                  <Input
                    aria-label="New reminder type name"
                    value={label}
                    required
                    maxLength={80}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </label>
                <RoleChecks value={roles} onChange={setRoles} />
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? "Adding…" : "Add type"}
                </Button>
              </form>
            </div>
          </details>
          <div className="space-y-2">
            <h3 className="font-medium">
              Status suggestion rules ({data.rules.length})
            </h3>
            {data.rules.map((rule) => (
              <RuleEditor
                key={`${rule.key}:${rule.version}`}
                rule={rule}
                onSaved={saved}
                onError={setError}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function RoleChecks({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {["ADMIN", "SALES", "SHIPPING"].map((role) => (
        <label className="flex items-center gap-1.5" key={role}>
          <input
            aria-label={`${role} type access`}
            type="checkbox"
            checked={value.includes(role)}
            disabled={role === "ADMIN"}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, role]
                  : value.filter((v) => v !== role),
              )
            }
          />
          {role === "ADMIN" ? "Admin" : role === "SALES" ? "Sales" : "Shipping"}
        </label>
      ))}
    </div>
  );
}
function TypeEditor({
  type,
  onSaved,
  onError,
}: {
  type: AutomationSettings["types"][number];
  onSaved: () => void;
  onError: (s: string) => void;
}) {
  const [label, setLabel] = useState(type.label),
    [active, setActive] = useState(type.isActive),
    [roles, setRoles] = useState<string[]>(type.allowedRoles),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void reminderAutomationApi
          .type(type.key, {
            label,
            isActive: active,
            allowedRoles: roles as typeof type.allowedRoles,
          })
          .then(onSaved)
          .catch((e) =>
            onError(e instanceof Error ? e.message : "Unable to save type."),
          )
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-xs text-muted-foreground">{type.key}</p>
      <label className="block text-sm">
        Name
        <Input
          aria-label={`${type.key} display name`}
          required
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <RoleChecks value={roles} onChange={setRoles} />
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Available for new reminders
        </label>
        <Button type="submit" size="sm" disabled={busy}>
          Save type
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Existing tasks and history are retained when a type is disabled.
      </p>
    </form>
  );
}
function RuleEditor({
  rule,
  onSaved,
  onError,
}: {
  rule: AutomationSettings["rules"][number];
  onSaved: () => void;
  onError: (s: string) => void;
}) {
  const [active, setActive] = useState(rule.isActive),
    [days, setDays] = useState(rule.delayDays),
    [minutes, setMinutes] = useState(rule.delayMinutes),
    [repeat, setRepeat] = useState<number | null>(rule.repeatDays),
    [busy, setBusy] = useState(false);
  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {rule.label}{" "}
        <span className="font-normal text-muted-foreground">
          · {rule.context.toLowerCase().replaceAll("_", " ")} /{" "}
          {rule.trigger.toLowerCase().replaceAll("_", " ")} ·{" "}
          {active ? "On" : "Off"}
        </span>
      </summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void reminderAutomationApi
            .rule(rule.key, {
              version: rule.version,
              isActive: active,
              delayDays: days,
              delayMinutes: minutes,
              repeatDays: repeat,
            })
            .then(onSaved)
            .catch((e) =>
              onError(
                e instanceof Error
                  ? e.message
                  : "Rule changed. Reload settings.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <p className="text-xs text-muted-foreground">
          {rule.typeKey} ·{" "}
          {rule.assignment === "SALES_AGENT"
            ? "Handoff to the order agent"
            : ["SHIPMENT_ORDER", "SHIPMENT", "REPLACEMENT"].includes(
                  rule.context,
                )
              ? "Shipping queue"
              : "Record owner"}
          {rule.stopStatus ? ` · Stop at ${rule.stopStatus.toLowerCase()}` : ""}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Offer this suggestion
        </label>
        {rule.requiresTime ? (
          <p className="text-sm text-muted-foreground">
            The user chooses the customer's agreed callback time.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Delay (calendar days)
              <Input
                aria-label={`${rule.key} delay days`}
                type="number"
                min={0}
                max={365}
                required
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>
            <label className="text-sm">
              Delay (minutes)
              <Input
                aria-label={`${rule.key} delay minutes`}
                type="number"
                min={0}
                max={525600}
                required
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
            <label className="text-sm">
              Repeat interval (days)
              <Input
                aria-label={`${rule.key} repeat days`}
                type="number"
                min={1}
                max={365}
                placeholder="One-time"
                value={repeat ?? ""}
                onChange={(e) =>
                  setRepeat(e.target.value ? Number(e.target.value) : null)
                }
              />
            </label>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Calendar-day delay preserves the customer's local clock; minute delay
          is used when the day delay is zero.
        </p>
        <Button type="submit" size="sm" disabled={busy}>
          Save suggestion rule
        </Button>
      </form>
    </details>
  );
}
