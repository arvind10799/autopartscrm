import { z } from "zod";

export const notificationSchema = z.object({
  id: z.string(),
  recipientUserId: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  isRead: z.boolean(),
  readAt: z.string().nullable(),
  clearedAt: z.string().nullable(),
  createdAt: z.string(),
  reminderId: z.string().nullable().optional(),
});

export const notificationsListSchema = z.array(notificationSchema);

export const notificationUnreadCountSchema = z.object({
  count: z.number(),
  notificationCount: z.number(),
  reminderCount: z.number(),
  latestReminder: z
    .object({ id: z.string(), title: z.string(), createdAt: z.string() })
    .nullable()
    .optional(),
});

export const notificationActionResultSchema = z.object({
  id: z.string().optional(),
  count: z.number().optional(),
});
