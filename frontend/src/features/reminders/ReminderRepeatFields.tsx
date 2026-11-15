"use client";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ReminderContext, ReminderRepeatInput } from "./reminder.schema";
export const repeatStopOptions: Record<ReminderContext, string[]> = {
  PERSONAL: [],
  WEBSITE_LEAD: ["CLOSED", "CONVERTED"],
  LEAD: ["CONVERTED"],
  ORDER: ["DELIVERED", "CANCELLED", "REFUNDED", "SIGNED"],
  SHIPMENT_ORDER: ["DELIVERED", "CANCELLED", "REFUNDED"],
  SHIPMENT: ["DELIVERED", "CANCELLED", "REFUNDED"],
  REPLACEMENT: ["DELIVERED", "CANCELLED", "REFUNDED"],
};
export function ReminderRepeatFields({
  value,
  onChange,
  context,
}: {
  value: ReminderRepeatInput;
  onChange: (value: ReminderRepeatInput) => void;
  context: ReminderContext;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
      <label className="block text-sm font-medium">
        Repeat
        <Select
          aria-label="Repeat frequency"
          value={value.frequency}
          onChange={(e) =>
            onChange({
              frequency: e.target.value as ReminderRepeatInput["frequency"],
              ...(e.target.value === "EVERY_N_DAYS" ? { intervalDays: 2 } : {}),
              ...(e.target.value === "WEEKLY" ? { weekday: 1 } : {}),
            })
          }
        >
          <option value="NONE">Does not repeat</option>
          <option value="DAILY">Daily</option>
          <option value="EVERY_N_DAYS">Every N days</option>
          <option value="WEEKLY">Weekly</option>
        </Select>
      </label>
      {value.frequency === "EVERY_N_DAYS" ? (
        <label className="block text-sm">
          Every how many days?
          <Input
            aria-label="Repeat interval days"
            type="number"
            min={1}
            max={365}
            required
            value={value.intervalDays ?? 2}
            onChange={(e) =>
              onChange({ ...value, intervalDays: Number(e.target.value) })
            }
          />
        </label>
      ) : null}
      {value.frequency === "WEEKLY" ? (
        <label className="block text-sm">
          Repeat on
          <Select
            aria-label="Repeat weekday"
            value={value.weekday ?? 1}
            onChange={(e) =>
              onChange({ ...value, weekday: Number(e.target.value) })
            }
          >
            {[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      {value.frequency !== "NONE" ? (
        <>
          <p className="text-xs text-muted-foreground">
            The next occurrence is created after completion, at the next future
            scheduled time. Leave the ending conditions blank to stop manually.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              End on date
              <Input
                aria-label="Repeat end date"
                type="date"
                value={value.untilDate ?? ""}
                onChange={(e) =>
                  onChange({ ...value, untilDate: e.target.value || undefined })
                }
              />
            </label>
            <label className="text-sm">
              Maximum occurrences
              <Input
                aria-label="Maximum occurrences"
                type="number"
                min={1}
                max={1000}
                placeholder="No limit"
                value={value.maxOccurrences ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    maxOccurrences: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </label>
          </div>
          {repeatStopOptions[context].length ? (
            <label className="block text-sm">
              Stop at record status
              <Select
                aria-label="Repeat stop status"
                value={value.stopStatus ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    stopStatus:
                      (e.target.value as ReminderRepeatInput["stopStatus"]) ||
                      undefined,
                  })
                }
              >
                <option value="">No additional status condition</option>
                {repeatStopOptions[context].map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase().replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Repetition stops when any ending condition is met. Record closure
            and lead-to-order conversion also stop the relevant repeating tasks.
          </p>
        </>
      ) : null}
    </div>
  );
}
