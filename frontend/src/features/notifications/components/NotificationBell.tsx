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
        className="relative h-9 w-9 px-0"
        onClick={handleToggle}
        aria-label="Open notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/70 bg-white shadow-2xl shadow-slate-950/15">
          <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <p className="font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                  : 'You are all caught up'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={handleMarkAllRead}
                disabled={isMutating || unreadCount === 0}
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
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
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-secondary/25 px-4 py-8 text-center text-sm text-muted-foreground">
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
                      'w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition hover:bg-sky-50/80',
                      notification.isRead
                        ? 'border-border/70 bg-white'
                        : 'border-sky-200 bg-sky-50',
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
                          <p className="truncate text-sm font-semibold text-foreground">
                            {notification.title}
                          </p>
                          {!notification.isRead ? (
                            <Badge variant="info" className="px-2 py-0.5">
                              New
                            </Badge>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatDateTime(notification.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Clear notification"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600"
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
