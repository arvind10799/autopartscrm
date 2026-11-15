"use client";
import { z } from "zod";
import { axiosBrowser } from "@/lib/api/axios-browser";
import { parseApiData } from "@/lib/api/parse-api-data";
import {
  createReminderSchema,
  type CreateReminderInput,
  type ReminderSuggestion,
} from "./reminder.schema";
const types = z.object({
  key: z.string(),
  label: z.string(),
  isActive: z.boolean(),
  allowedRoles: z.array(z.enum(["ADMIN", "SALES", "SHIPPING"])),
});
const rules = z.object({
  key: z.string(),
  label: z.string(),
  context: z.string(),
  trigger: z.string(),
  typeKey: z.string(),
  assignment: z.string(),
  delayDays: z.number(),
  delayMinutes: z.number(),
  requiresTime: z.boolean(),
  repeatDays: z.number().nullable(),
  stopStatus: z.string().nullable(),
  isActive: z.boolean(),
  version: z.number(),
});
const settings = z.object({ types: z.array(types), rules: z.array(rules) });
export type AutomationSettings = z.infer<typeof settings>;
export const reminderAutomationApi = {
  async accept(s: ReminderSuggestion, input: CreateReminderInput) {
    const r = await axiosBrowser.post(
      `/api/reminders/automation/suggestions/${s.id}/accept`,
      {
        ...createReminderSchema.parse(input),
        version: s.version,
        ruleVersion: s.ruleVersion,
      },
    );
    return parseApiData(r, z.object({ id: z.string() }), {
      emptyMessage: "Suggestion could not be saved.",
      invalidMessage: "Invalid suggestion response.",
    });
  },
  async dismiss(s: ReminderSuggestion) {
    await axiosBrowser.post(
      `/api/reminders/automation/suggestions/${s.id}/dismiss`,
      { version: s.version },
    );
  },
  async settings() {
    return parseApiData(
      await axiosBrowser.get("/api/reminders/automation/settings"),
      settings,
      {
        emptyMessage: "Automation settings unavailable.",
        invalidMessage: "Invalid automation settings.",
      },
    );
  },
  async type(key: string, input: Partial<AutomationSettings["types"][number]>) {
    await axiosBrowser.patch(
      `/api/reminders/automation/types/${encodeURIComponent(key)}`,
      input,
    );
  },
  async createType(input: {
    key: string;
    label: string;
    allowedRoles: string[];
  }) {
    await axiosBrowser.post("/api/reminders/automation/types", input);
  },
  async rule(
    key: string,
    input: {
      version: number;
      isActive: boolean;
      delayDays: number;
      delayMinutes: number;
      repeatDays: number | null;
    },
  ) {
    await axiosBrowser.patch(
      `/api/reminders/automation/rules/${encodeURIComponent(key)}`,
      input,
    );
  },
};
