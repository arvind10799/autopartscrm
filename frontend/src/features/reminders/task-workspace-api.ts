"use client";
import { reminderPolicySchema } from "./reminder-policy.schema";
import { z } from "zod";
import { axiosBrowser } from "@/lib/api/axios-browser";
import { parseApiData } from "@/lib/api/parse-api-data";
import { reminderSchema, contexts } from "./reminder.schema";
import type { ReminderContext } from "./reminder.schema";

export const taskCountsSchema = z.object({
  all: z.number(),
  overdue: z.number(),
  today: z.number(),
  upcoming: z.number(),
  handed: z.number(),
  newHandoffs: z.number(),
  done: z.number(),
  cancelled: z.number(),
  badge: z.number(),
  working: z.number(),
});
export const taskSummarySchema = taskCountsSchema.extend({
  displayTimeZone: z.string(),
  asOf: z.string(),
});
export type TaskSummary = z.infer<typeof taskSummarySchema>;
export const taskItemSchema = reminderSchema.extend({
  displayDay: z.string(),
  received: z.boolean(),
  statusOnly: z.boolean(),
  record: z.object({
    id: z.string().uuid().nullable(),
    href: z.string().nullable(),
    customerName: z.string(),
    reference: z.string(),
    orderNumber: z.string().nullable(),
    phone: z.string().nullable(),
    state: z.string().nullable(),
    part: z.string().nullable(),
    vehicle: z.string(),
    amount: z.string().nullable(),
    currency: z.string(),
    status: z.string().nullable(),
    carrier: z.string().nullable(),
    tracking: z.string().nullable(),
  }),
});
export type TaskItem = z.infer<typeof taskItemSchema>;
const workspaceSchema = z.object({
  policy: reminderPolicySchema.optional(),
  items: z.array(taskItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  counts: taskCountsSchema,
  types: z.array(z.object({ key: z.string(), label: z.string() })),
  owners: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
      isActive: z.boolean(),
    }),
  ),
  dayCounts: z.record(z.number()),
  highlights: z
    .object({ upcoming: z.array(taskItemSchema), overdue: z.number() })
    .optional(),
  displayTimeZone: z.string(),
  asOf: z.string(),
});
export type TaskWorkspace = z.infer<typeof workspaceSchema>;
export type TaskParams = Record<string, string | number | boolean | undefined>;
const recordsSchema = z.array(
  z.object({ id: z.string(), label: z.string(), timeZone: z.string() }),
);
export type TaskRecordChoice = z.infer<typeof recordsSchema>[number];
const reportSchema = z.object({
  rows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      isActive: z.boolean(),
      open: z.number(),
      overdue: z.number(),
      oldest: z.string().nullable(),
    }),
  ),
  flagged: z.number(),
  unassigned: z.number(),
  handoffsToShipping: z.number(),
  handoffsToSales: z.number(),
  displayTimeZone: z.string(),
  asOf: z.string(),
});
export type FollowUpsReport = z.infer<typeof reportSchema>;
async function read<T>(
  path: string,
  schema: z.ZodType<T>,
  params?: TaskParams,
  signal?: AbortSignal,
): Promise<T> {
  const response = await axiosBrowser.get(`/api/reminders/${path}`, {
    params,
    signal,
  });
  return parseApiData(response, schema, {
    emptyMessage: "Tasks could not be loaded.",
    invalidMessage: "Invalid task response.",
  });
}
export const taskWorkspaceApi = {
  summary: (signal?: AbortSignal) =>
    read("summary", taskSummarySchema, undefined, signal),
  list: (params: TaskParams, signal?: AbortSignal) =>
    read("workspace", workspaceSchema, params, signal),
  records: (context: ReminderContext, search: string, signal?: AbortSignal) =>
    read("records", recordsSchema, { context, search }, signal),
  followUps: (params: TaskParams, signal?: AbortSignal) =>
    read("follow-ups", reportSchema, params, signal),
  seen: async (seenThrough: string) => {
    await axiosBrowser.post("/api/reminders/inbox/seen", { seenThrough });
  },
  reschedule: async (id: string, version: number, dueAt: string) => {
    await axiosBrowser.patch(`/api/reminders/${id}/reschedule`, {
      version,
      dueAt,
    });
  },
};
export const contextLabels: Record<(typeof contexts)[number], string> = {
  PERSONAL: "Personal task",
  WEBSITE_LEAD: "Website lead",
  LEAD: "Lead",
  ORDER: "Order",
  SHIPMENT_ORDER: "Shipment order",
  SHIPMENT: "Shipment",
  REPLACEMENT: "Replacement",
};
