'use client';

import { Bell, CheckCheck, Loader2, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/features/orders/lib/order-formatters';
import { notificationsApi } from '../api/notifications-api';
import type { AppNotification } from '../types/notification.types';

const POLL_INTERVAL_MS = 45000;

export function NotificationBell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = async () => {
    setError(null);
    try {
      const [items, unread] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.unreadCount(),
      ]);
      setNotifications(items);
      setUnreadCount(unread.count);
    } catch {
      setError('Unable to load notifications.');
    }
  };

  useEffect(() => {
    void refreshNotifications();
    const intervalId = window.setInterval(() => {
      void refreshNotifications();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);

    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const handleToggle = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      setIsLoading(true);
      await refreshNotifications();
      setIsLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    setIsMutating(true);
    try {
      await notificationsApi.markAllRead();
      await refreshNotifications();
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearAll = async () => {
    setIsMutating(true);
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsMutating(false);
    }
  };

  const handleOpenNotification = async (notification: AppNotification) => {
    if (!notification.isRead) {
      await notificationsApi.markRead(notification.id).catch(() => undefined);
    }

    setIsOpen(false);
    void refreshNotifications();
    router.push(resolveNotificationHref(notification));
  };

  const handleClearOne = async (
    notification: AppNotification,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    setIsMutating(true);
    try {
      await notificationsApi.clearOne(notification.id);
      setNotifications((current) =>
        current.filter((item) => item.id !== notification.id),
      );
      if (!notification.isRead) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="relative h-10 w-10 rounded-full border-slate-200 bg-white px-0 text-slate-900 shadow-sm hover:border-[#ff5a00]/35 hover:bg-orange-50 hover:text-[#ff5a00] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-orange-950/20 dark:hover:text-orange-300"
        onClick={handleToggle}
        aria-label="Open notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff5a00] px-1.5 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-[#020b18]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/15 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/40">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div>
              <p className="font-semibold text-slate-950 dark:text-white">Notifications</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                  : 'You are all caught up'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-[#0f6fb7] hover:bg-sky-50 hover:text-[#0b5f9e] dark:text-sky-300 dark:hover:bg-sky-950/30"
                onClick={handleMarkAllRead}
                disabled={isMutating || unreadCount === 0}
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                onClick={handleClearAll}
                disabled={isMutating || notifications.length === 0}
                title="Clear all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                No notifications yet.
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition hover:bg-orange-50/60 dark:hover:bg-slate-900',
                      notification.isRead
                        ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
                        : 'border-orange-200 bg-orange-50/80 dark:border-orange-900/50 dark:bg-orange-950/20',
                    )}
                    onClick={() => void handleOpenNotification(notification)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleOpenNotification(notification);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                            {notification.title}
                          </p>
                          {!notification.isRead ? (
                            <Badge variant="outline" className="border-[#ff5a00]/30 bg-white px-2 py-0.5 text-[#d94d00] dark:bg-slate-950 dark:text-orange-300">
                              New
                            </Badge>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {notification.message}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {formatDateTime(notification.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Clear notification"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600 dark:hover:bg-slate-800"
                        onClick={(event) => {
                          void handleClearOne(notification, event);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function resolveNotificationHref(notification: AppNotification): string {
  if (notification.entityType === 'SHIPMENT') {
    return `/shipments/${notification.entityId}`;
  }

  if (notification.entityType === 'ORDER') {
    return `/orders/${notification.entityId}`;
  }

  return '/dashboard';
}
