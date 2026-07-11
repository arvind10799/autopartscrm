export interface AppNotification {
  id: string;
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  entityType: 'ORDER' | 'SHIPMENT' | string;
  entityId: string;
  isRead: boolean;
  readAt: string | null;
  clearedAt: string | null;
  createdAt: string;
}

export interface NotificationUnreadCount {
  count: number;
}

