export interface AppNotification {
  id: string;
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  entityType: "ORDER" | "SHIPMENT" | string;
  entityId: string;
  isRead: boolean;
  readAt: string | null;
  clearedAt: string | null;
  createdAt: string;
  reminderId?: string | null;
}

export interface NotificationUnreadCount {
  count: number;
  notificationCount: number;
  reminderCount: number;
  latestReminder?: { id: string; title: string; createdAt: string } | null;
}

export type NotificationCategory = "GENERAL" | "REMINDERS";
