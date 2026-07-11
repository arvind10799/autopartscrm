'use client';

import { axiosBrowser } from '@/lib/api/axios-browser';
import { assertApiSuccess, parseApiData } from '@/lib/api/parse-api-data';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  notificationActionResultSchema,
  notificationsListSchema,
  notificationUnreadCountSchema,
} from '../schemas/notification.schema';
import type {
  AppNotification,
  NotificationUnreadCount,
} from '../types/notification.types';

export const notificationsApi = {
  async list(): Promise<AppNotification[]> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/notifications?limit=30',
    );

    return parseApiData(response, notificationsListSchema, {
      emptyMessage: 'No notifications were returned.',
      invalidMessage: 'Notification response payload was invalid.',
    });
  },

  async unreadCount(): Promise<NotificationUnreadCount> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/notifications/unread-count',
    );

    return parseApiData(response, notificationUnreadCountSchema, {
      emptyMessage: 'Unread count was not returned.',
      invalidMessage: 'Unread count response payload was invalid.',
    });
  },

  async markRead(id: string): Promise<void> {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/notifications/${id}/read`,
    );
    parseApiData(response, notificationActionResultSchema, {
      emptyMessage: 'Notification read status was not returned.',
      invalidMessage: 'Notification action response payload was invalid.',
    });
  },

  async markAllRead(): Promise<void> {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      '/api/notifications/read-all',
    );
    assertApiSuccess(response, 'Unable to mark notifications as read.');
  },

  async clearOne(id: string): Promise<void> {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/notifications/${id}/clear`,
    );
    assertApiSuccess(response, 'Unable to clear notification.');
  },

  async clearAll(): Promise<void> {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      '/api/notifications/clear-all',
    );
    assertApiSuccess(response, 'Unable to clear notifications.');
  },
};

