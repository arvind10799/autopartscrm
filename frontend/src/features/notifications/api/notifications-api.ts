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

function buildNotificationGroupQuery(entityType: string, entityId: string) {
  return new URLSearchParams({ entityType, entityId }).toString();
}

export const notificationsApi = {
  async list(options?: { unreadOnly?: boolean }): Promise<AppNotification[]> {
    const searchParams = new URLSearchParams({ limit: '30' });

    if (options?.unreadOnly) {
      searchParams.set('unreadOnly', 'true');
    }

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/notifications?${searchParams.toString()}`,
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

  async markGroupRead(entityType: string, entityId: string): Promise<void> {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/notifications/group/read?${buildNotificationGroupQuery(
        entityType,
        entityId,
      )}`,
    );
    parseApiData(response, notificationActionResultSchema, {
      emptyMessage: 'Notification group read status was not returned.',
      invalidMessage: 'Notification group action response payload was invalid.',
    });
  },

  async clearOne(id: string): Promise<void> {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/notifications/${id}/clear`,
    );
    assertApiSuccess(response, 'Unable to clear notification.');
  },

  async clearGroup(entityType: string, entityId: string): Promise<void> {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/notifications/group/clear?${buildNotificationGroupQuery(
        entityType,
        entityId,
      )}`,
    );
    parseApiData(response, notificationActionResultSchema, {
      emptyMessage: 'Notification group clear status was not returned.',
      invalidMessage: 'Notification group action response payload was invalid.',
    });
  },

  async clearAll(): Promise<void> {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      '/api/notifications/clear-all',
    );
    assertApiSuccess(response, 'Unable to clear notifications.');
  },
};

