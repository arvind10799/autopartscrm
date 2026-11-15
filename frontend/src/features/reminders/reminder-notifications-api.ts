"use client";
import { z } from "zod";
import { axiosBrowser } from "@/lib/api/axios-browser";
import { parseApiData } from "@/lib/api/parse-api-data";
import { displayZones, reminderSchema } from "./reminder.schema";
const preferences = z.object({
  displayTimeZone: z.enum(displayZones),
  workingStartMinute: z.number(),
  workingEndMinute: z.number(),
  dailyDigestEnabled: z.boolean(),
});
export type ReminderPreferences = z.infer<typeof preferences>;
const settings = z.object({
  deliveryEnabled: z.boolean(),
  secondAlertMinutes: z.number().nullable(),
  escalationMinutes: z.number().nullable(),
  workingMarkerMinutes: z.number(),
  snoozeFlagCount: z.number().nullable(),
  pending: z.number(),
  failed: z.number(),
  serverEnabled: z.boolean(),
  pushConfigured: z.boolean(),
  emailConfigured: z.boolean(),
});
export type ReminderSettings = z.infer<typeof settings>;
const alert = z.object({
  item: reminderSchema,
  displayTimeZone: z.string(),
  href: z.string().nullable(),
});
export type ReminderAlert = z.infer<typeof alert>;
const config = z.object({
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
});
async function get<T>(url: string, schema: z.ZodType<T>) {
  return parseApiData(await axiosBrowser.get(url), schema, {
    emptyMessage: "Reminder settings unavailable.",
    invalidMessage: "Invalid reminder response.",
  });
}
export const reminderNotificationsApi = {
  configuration: () =>
    get("/api/reminders/notifications/configuration", config),
  preferences: (id?: string) =>
    get(`/api/reminders/preferences/${id ? `users/${id}` : "me"}`, preferences),
  savePreferences: async (input: ReminderPreferences, id?: string) => {
    await axiosBrowser.patch(
      `/api/reminders/preferences/${id ? `users/${id}` : "me"}`,
      input,
    );
    window.dispatchEvent(new Event("crm:reminders-changed"));
  },
  settings: () => get("/api/reminders/notifications/settings", settings),
  saveSettings: async (input: Partial<ReminderSettings>) => {
    await axiosBrowser.patch("/api/reminders/notifications/settings", input);
  },
  subscribe: async (input: PushSubscriptionJSON) => {
    await axiosBrowser.post("/api/reminders/notifications/subscribe", input);
  },
  unsubscribe: async (endpoint: string) => {
    await axiosBrowser.post("/api/reminders/notifications/unsubscribe", {
      endpoint,
    });
  },
  alert: (id: string) =>
    get(`/api/reminders/notifications/alerts/${id}`, alert),
  action: async (
    id: string,
    input: {
      action: "COMPLETE" | "SNOOZE" | "WORK";
      version: number;
      snoozeMinutes?: number;
      completionNote?: string;
    },
  ) => {
    await axiosBrowser.post(`/api/reminders/notifications/alerts/${id}`, input);
    window.dispatchEvent(new Event("crm:reminders-changed"));
    window.dispatchEvent(new Event("crm:notifications-changed"));
  },
};
