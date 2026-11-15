"use client";
import { z } from "zod";
import { axiosBrowser } from "@/lib/api/axios-browser";
import { parseApiData } from "@/lib/api/parse-api-data";
import { displayZones } from "./reminder.schema";
import { followUpSchema } from "./follow-up.schema";
export { defaultPolicy, reminderPolicySchema } from "./reminder-policy.schema";
export type { ReminderPolicy } from "./reminder-policy.schema";
import {
  reminderPolicySchema,
  type ReminderPolicy,
} from "./reminder-policy.schema";
const policyResponseSchema = reminderPolicySchema.extend({
  defaultStateTimeZones: z.record(z.string()).optional(),
});
const reportSchema = z.object({
  rows: z.array(
    z.object({
      id: z.string(),
      reference: z.string(),
      customer: z.string(),
      owner: z.string(),
      date: z.string(),
      href: z.string(),
      followUp: followUpSchema.nullish(),
      completed: z.number().optional(),
      onTime: z.number().optional(),
      onTimePercent: z.number().optional(),
      queueCount: z.number().optional(),
      queueDelayMinutes: z.number().nullable().optional(),
      type: z.string().optional(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  kind: z.string(),
  periodBasis: z.string(),
  displayTimeZone: z.string(),
  owners: z.array(
    z.object({ id: z.string(), name: z.string(), isActive: z.boolean() }),
  ),
  types: z.array(z.object({ key: z.string(), label: z.string() })),
  asOf: z.string(),
});
export type ReminderReport = z.infer<typeof reportSchema>;
export type ReminderReportParams = {
  kind: string;
  from?: string;
  to?: string;
  ownerId?: string;
  typeKey?: string;
  displayTimeZone?: string;
  page?: number;
  limit?: number;
};
export const reminderPhase6Api = {
  async policy() {
    return parseApiData(
      await axiosBrowser.get("/api/reminders/policy"),
      policyResponseSchema,
      {
        emptyMessage: "Reminder settings unavailable.",
        invalidMessage: "Invalid reminder settings.",
      },
    );
  },
  async savePolicy(input: ReminderPolicy) {
    return parseApiData(
      await axiosBrowser.patch(
        "/api/reminders/policy",
        reminderPolicySchema.strict().parse(input),
      ),
      reminderPolicySchema,
      {
        emptyMessage: "Settings save failed.",
        invalidMessage: "Invalid settings response.",
      },
    );
  },
  async report(params: ReminderReportParams, signal?: AbortSignal) {
    return parseApiData(
      await axiosBrowser.get("/api/reminders/reports", { params, signal }),
      reportSchema,
      {
        emptyMessage: "Report unavailable.",
        invalidMessage: "Invalid report response.",
      },
    );
  },
};
export async function downloadReminderFile(
  path: "reports/export.xlsx" | "calendar-export.ics",
  params: Record<string, string | number | boolean | undefined>,
  filename: string,
) {
  const response = await axiosBrowser.get<Blob>("/api/reminders/" + path, {
    params,
    responseType: "blob",
  });
  if (String(response.headers["content-type"]).includes("application/json"))
    throw new Error("Export failed. Refresh the page and try again.");
  const url = URL.createObjectURL(response.data),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
export function outsideCallingWindow(
  time: string,
  policy: Pick<
    ReminderPolicy,
    "callingWindowEnabled" | "callingStartMinute" | "callingEndMinute"
  >,
) {
  if (
    !policy.callingWindowEnabled ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)
  )
    return false;
  const minute = Number(time.slice(11, 13)) * 60 + Number(time.slice(14)),
    a = policy.callingStartMinute,
    b = policy.callingEndMinute;
  return !(a < b ? minute >= a && minute < b : minute >= a || minute < b);
}
