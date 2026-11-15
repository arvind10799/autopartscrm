"use client";
import { z } from "zod";
import { axiosBrowser } from "@/lib/api/axios-browser";
import { parseApiData } from "@/lib/api/parse-api-data";
import type { ApiEnvelope } from "@/features/auth/types/auth.types";
import {
  createReminderSchema,
  reminderActionSchema,
  recordRemindersSchema,
  reminderHistorySchema,
  type CreateReminderInput,
  type ReminderActionInput,
  type ReminderContext,
} from "./reminder.schema";

export const remindersApi = {
  async record(
    context: ReminderContext,
    recordId: string,
    page = 1,
    history = false,
    signal?: AbortSignal,
  ) {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      "/api/reminders/record",
      { params: { context, recordId, page, history }, signal },
    );
    return parseApiData(response, recordRemindersSchema, {
      emptyMessage: "Reminders could not be loaded.",
      invalidMessage: "Invalid reminders response.",
    });
  },
  async create(input: CreateReminderInput) {
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      "/api/reminders",
      createReminderSchema.parse(input),
    );
    return parseApiData(response, z.object({ id: z.string().uuid() }), {
      emptyMessage: "Reminder could not be saved.",
      invalidMessage: "Invalid reminder response.",
    });
  },
  async action(id: string, input: ReminderActionInput) {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/reminders/${id}`,
      reminderActionSchema.parse(input),
    );
    return parseApiData(response, z.object({ id: z.string().uuid() }), {
      emptyMessage: "Reminder could not be updated.",
      invalidMessage: "Invalid reminder response.",
    });
  },
  async history(id: string) {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/reminders/${id}/history`,
    );
    return parseApiData(response, reminderHistorySchema, {
      emptyMessage: "History is unavailable.",
      invalidMessage: "Invalid reminder history.",
    });
  },
  async displayZone(displayTimeZone: string) {
    await axiosBrowser.patch("/api/reminders/preferences/me", {
      displayTimeZone,
    });
  },
};
