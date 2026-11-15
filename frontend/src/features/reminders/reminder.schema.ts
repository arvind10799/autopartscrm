import { reminderPolicySchema } from "./reminder-policy.schema";
import { z } from "zod";
export const contexts = [
  "PERSONAL",
  "WEBSITE_LEAD",
  "LEAD",
  "ORDER",
  "SHIPMENT_ORDER",
  "SHIPMENT",
  "REPLACEMENT",
] as const;
export type ReminderContext = (typeof contexts)[number];
export const displayZones = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
] as const;
export const zoneLabels: Record<string, string> = {
  "America/Los_Angeles": "Pacific",
  "America/Denver": "Mountain",
  "America/Chicago": "Central",
  "America/New_York": "Eastern",
  "America/Phoenix": "Arizona",
};
const localTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time.");
export const reminderRepeatSchema = z
  .object({
    frequency: z.enum(["NONE", "DAILY", "EVERY_N_DAYS", "WEEKLY"]),
    intervalDays: z.number().int().min(1).max(365).optional(),
    weekday: z.number().int().min(0).max(6).optional(),
    untilDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    maxOccurrences: z.number().int().min(1).max(1000).optional(),
    stopStatus: z
      .enum([
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
        "SIGNED",
        "CLOSED",
        "CONVERTED",
      ])
      .optional(),
  })
  .strict();
export type ReminderRepeatInput = z.infer<typeof reminderRepeatSchema>;
export const reminderSuggestionSchema = z.object({
  id: z.string().uuid(),
  version: z.number(),
  ruleVersion: z.number(),
  label: z.string(),
  typeKey: z.string(),
  typeLabel: z.string(),
  assignment: z.enum(["RECORD_OWNER", "SALES_AGENT"]),
  localDueAt: z.string().nullable(),
  timeZone: z.string(),
  requiresTime: z.boolean(),
  alreadyScheduled: z.boolean().default(false),
  repeat: reminderRepeatSchema.optional(),
});
export type ReminderSuggestion = z.infer<typeof reminderSuggestionSchema>;
export const createReminderSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    typeKey: z.string().min(1).max(50),
    context: z.enum(contexts),
    recordId: z.string().uuid().optional(),
    assignment: z
      .enum(["SELF", "RECORD_OWNER", "SHIPPING_QUEUE", "SALES_AGENT"])
      .optional(),
    localDueAt: localTime,
    timeZone: z.enum(displayZones).optional(),
    utcOffsetMinutes: z.number().int().min(-720).max(840).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    note: z.string().max(1000).optional(),
    earlyAlertMinutes: z
      .union([z.literal(0), z.literal(5), z.literal(15), z.literal(30)])
      .default(0),
    notifyCreatorOnCompletion: z.boolean().optional(),
    acknowledgeDuplicate: z.boolean().optional(),
    repeat: reminderRepeatSchema.optional(),
  })
  .strict();
export type CreateReminderInput = z.input<typeof createReminderSchema>;
const version = z.number().int().positive();
export const reminderActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("COMPLETE"),
      version,
      completionNote: z.string().max(1000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("SNOOZE"),
      version,
      snoozeMinutes: z.number().int().min(1).max(43200).optional(),
      localDueAt: localTime.optional(),
      utcOffsetMinutes: z.number().int().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("EDIT"),
      version,
      title: z.string().trim().min(1).max(120).optional(),
      typeKey: z.string().max(50).optional(),
      repeat: reminderRepeatSchema.optional(),
      repeatScope: z.enum(["THIS", "FUTURE"]).optional(),
      note: z.string().max(1000).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
      localDueAt: localTime.optional(),
      timeZone: z.enum(displayZones).optional(),
      utcOffsetMinutes: z.number().int().optional(),
      earlyAlertMinutes: z
        .union([z.literal(0), z.literal(5), z.literal(15), z.literal(30)])
        .optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("CANCEL"),
      version,
      cancelReason: z.string().trim().min(1).max(255).optional(),
      repeatScope: z.enum(["THIS", "FUTURE"]).optional(),
    })
    .strict(),
  z.object({ action: z.enum(["DELETE", "WORK"]), version }).strict(),
]);
export type ReminderActionInput = z.input<typeof reminderActionSchema>;
export const reminderSchema = z.object({
  series: z
    .object({
      id: z.string(),
      frequency: z.enum(["DAILY", "EVERY_N_DAYS", "WEEKLY"]),
      intervalDays: z.number(),
      weekday: z.number().nullable(),
      untilDate: z.string().nullable(),
      maxOccurrences: z.number().nullable(),
      stopStatus: z.string().nullable(),
      isActive: z.boolean(),
      version: z.number(),
      completedCount: z.number(),
      stopReason: z.string().nullable(),
    })
    .nullable()
    .optional(),
  seriesId: z.string().nullable().optional(),
  occurrenceNumber: z.number().nullable().optional(),
  id: z.string().uuid(),
  title: z.string(),
  typeKey: z.string(),
  context: z.enum(contexts),
  version: z.number(),
  status: z.enum(["OPEN", "SNOOZED", "COMPLETED", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  dueAt: z.string(),
  localDueAt: z.string(),
  timeZone: z.string(),
  earlyAlertMinutes: z.number(),
  note: z.string().nullable(),
  ownerKind: z.enum(["USER", "SHIPPING_QUEUE"]),
  ownerUserId: z.string().nullable(),
  createdById: z.string(),
  assignedByAdmin: z.boolean(),
  isHandoff: z.boolean(),
  owner: z
    .object({ name: z.string(), isActive: z.boolean(), role: z.string() })
    .nullable(),
  createdBy: z.object({ name: z.string() }),
  workingBy: z.object({ name: z.string() }).nullable(),
  workingById: z.string().nullable(),
  workingUntil: z.string().nullable(),
  snoozeCount: z.number(),
  completionNote: z.string().nullable(),
  cancelReason: z.string().nullable(),
  deletedAt: z.string().nullable(),
  overdue: z.boolean(),
  needsAdmin: z.boolean().nullable(),
  actions: z.object({
    edit: z.boolean(),
    complete: z.boolean(),
    snooze: z.boolean(),
    delete: z.boolean(),
    work: z.boolean(),
  }),
});
export type ReminderItem = z.infer<typeof reminderSchema>;
export const recordRemindersSchema = z.object({
  policy: reminderPolicySchema.optional(),
  suggestions: z.array(reminderSuggestionSchema).default([]),
  shippingDone: z.array(reminderSchema).default([]),
  items: z.array(reminderSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  openCount: z.number(),
  overdueCount: z.number(),
  types: z.array(z.object({ key: z.string(), label: z.string() })),
  assignments: z.array(z.string()),
  timeZone: z.string(),
  displayTimeZone: z.string(),
  canCreate: z.boolean(),
  recordClosed: z.boolean(),
});
export type RecordReminders = z.infer<typeof recordRemindersSchema>;
export const reminderHistorySchema = z.array(
  z.object({
    id: z.string(),
    action: z.string(),
    createdAt: z.string(),
    actor: z.object({ name: z.string() }).nullable(),
    changes: z.record(z.unknown()).nullable(),
  }),
);
