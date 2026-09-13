'use client';

import { Bell, CheckCheck, Loader2, PhoneIncoming, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/features/orders/lib/order-formatters';
import { notificationsApi } from '../api/notifications-api';
import type { AppNotification } from '../types/notification.types';

const POLL_INTERVAL_MS = 10000;
const INCOMING_CALL_NOTIFICATION_TYPE = 'INCOMING_CUSTOMER_CALL';
const DISMISSED_CALL_NOTIFICATION_KEY = 'crm-dismissed-call-notifications';

export function NotificationBell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [incomingCallNotification, setIncomingCallNotification] =
    useState<AppNotification | null>(null);

  const refreshNotifications = async () => {
    setError(null);
    try {
      const [items, unread] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.unreadCount(),
      ]);
      setNotifications(items);
      setUnreadCount(unread.count);
      setIncomingCallNotification(
        items.find(
          (item) =>
            item.type === INCOMING_CALL_NOTIFICATION_TYPE &&
            !item.isRead &&
            !isCallNotificationDismissed(item.id),
        ) ?? null,
      );
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

  const handleDismissIncomingCall = async () => {
    if (!incomingCallNotification) {
      return;
    }

    rememberDismissedCallNotification(incomingCallNotification.id);
    setIncomingCallNotification(null);
    await notificationsApi.markRead(incomingCallNotification.id).catch(
      () => undefined,
    );
    void refreshNotifications();
  };

  return (
    <div ref={containerRef} className="relative">
      {incomingCallNotification ? (
        <div className="fixed right-4 top-20 z-[80] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-sky-300/40 bg-slate-950 text-white shadow-2xl shadow-slate-950/35 ring-1 ring-white/10">
          <div className="flex items-start gap-3 border-b border-white/10 bg-sky-500/10 px-4 py-4">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400/20 text-sky-200">
              <PhoneIncoming className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-200">
                Existing customer call
              </p>
              <h2 className="mt-1 truncate text-base font-black">
                {incomingCallNotification.title.replace(/^Incoming call:\s*/i, '')}
              </h2>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss incoming call notification"
              onClick={() => {
                void handleDismissIncomingCall();
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4 px-4 py-4">
            <p className="text-sm leading-6 text-slate-300">
              {incomingCallNotification.message}
            </p>
            <Button
              className="h-11 w-full rounded-2xl bg-[#ff5a00] text-sm font-black text-white shadow-lg shadow-orange-950/30 hover:bg-[#e65000]"
              onClick={() => {
                void handleOpenNotification(incomingCallNotification);
                setIncomingCallNotification(null);
              }}
            >
              Open CRM Record
            </Button>
          </div>
        </div>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className="relative h-9 w-9 rounded-full border-slate-200 bg-white px-0 text-slate-900 shadow-sm hover:border-[#ff5a00]/35 hover:bg-orange-50 hover:text-[#ff5a00] sm:h-10 sm:w-10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-orange-950/20 dark:hover:text-orange-300"
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
        <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/15 sm:top-12 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/40">
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

  if (notification.entityType === 'LEAD') {
    return '/leads';
  }

  return '/dashboard';
}

function getDismissedCallNotificationIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(DISMISSED_CALL_NOTIFICATION_KEY) ?? '[]',
    );

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function isCallNotificationDismissed(id: string): boolean {
  return getDismissedCallNotificationIds().includes(id);
}

function rememberDismissedCallNotification(id: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const nextIds = [...new Set([...getDismissedCallNotificationIds(), id])].slice(
    -50,
  );
  window.sessionStorage.setItem(
    DISMISSED_CALL_NOTIFICATION_KEY,
    JSON.stringify(nextIds),
  );
}
