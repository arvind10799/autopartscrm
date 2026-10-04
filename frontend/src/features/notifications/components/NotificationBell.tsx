'use client';

import {
  Bell,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/features/orders/lib/order-formatters';
import { cn } from '@/lib/utils/cn';
import { notificationsApi } from '../api/notifications-api';
import type { AppNotification } from '../types/notification.types';

const POLL_INTERVAL_MS = 45000;

type NotificationFilter = 'all' | 'unread' | 'orders' | 'shipments';

type NotificationGroup = {
  key: string;
  entityType: string;
  entityId: string;
  latest: AppNotification;
  items: AppNotification[];
  unreadCount: number;
};

const NOTIFICATION_FILTERS: Array<{
  id: NotificationFilter;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'orders', label: 'Orders' },
  { id: 'shipments', label: 'Shipments' },
];

export function NotificationBell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const refreshUnreadCount = useCallback(async () => {
    try {
      const unread = await notificationsApi.unreadCount();
      setUnreadCount(unread.count);
    } catch {
      // Keep the last known badge count if the lightweight refresh fails.
    }
  }, []);

  const refreshNotifications = useCallback(
    async (options?: { showSpinner?: boolean }) => {
      if (options?.showSpinner) {
        setIsRefreshing(true);
      }

      setError(null);
      try {
        const [items, unread] = await Promise.all([
          notificationsApi.list({ unreadOnly: activeFilter === 'unread' }),
          notificationsApi.unreadCount(),
        ]);
        setNotifications(items);
        setUnreadCount(unread.count);
      } catch {
        setError('Unable to load notifications.');
      } finally {
        if (options?.showSpinner) {
          setIsRefreshing(false);
        }
      }
    },
    [activeFilter],
  );

  useEffect(() => {
    if (isOpen) {
      return;
    }

    const refresh = () => {
      if (document.visibilityState !== 'hidden') {
        void refreshUnreadCount();
      }
    };

    refresh();
    const intervalId = window.setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, refreshUnreadCount]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsLoading(true);
    void refreshNotifications().finally(() => {
      setIsLoading(false);
    });
  }, [isOpen, refreshNotifications]);

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

  const visibleNotifications = useMemo(
    () => filterNotifications(notifications, activeFilter),
    [activeFilter, notifications],
  );

  const groups = useMemo(
    () => buildNotificationGroups(visibleNotifications),
    [visibleNotifications],
  );

  const handleToggle = () => {
    setIsOpen((current) => !current);
  };

  const handleFilterChange = (filter: NotificationFilter) => {
    setActiveFilter(filter);
    setExpandedGroups(new Set());
  };

  const toggleGroup = (group: NotificationGroup) => {
    if (group.items.length === 1) {
      void handleOpenGroup(group);
      return;
    }

    setExpandedGroups((current) => {
      const next = new Set(current);

      if (next.has(group.key)) {
        next.delete(group.key);
      } else {
        next.add(group.key);
      }

      return next;
    });
  };

  const handleMarkAllRead = async () => {
    setIsMutating(true);
    const unreadBefore = unreadCount;
    const notificationsBefore = notifications;

    setUnreadCount(0);
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
    );

    try {
      await notificationsApi.markAllRead();
      await refreshNotifications();
    } catch {
      setUnreadCount(unreadBefore);
      setNotifications(notificationsBefore);
      setError('Unable to mark notifications as read.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearAll = async () => {
    setIsMutating(true);
    const unreadBefore = unreadCount;
    const notificationsBefore = notifications;

    setNotifications([]);
    setUnreadCount(0);
    setExpandedGroups(new Set());

    try {
      await notificationsApi.clearAll();
    } catch {
      setUnreadCount(unreadBefore);
      setNotifications(notificationsBefore);
      setError('Unable to clear notifications.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleOpenGroup = async (group: NotificationGroup) => {
    await markGroupRead(group, { silent: true });
    setIsOpen(false);
    router.push(resolveNotificationHref(group.latest));
  };

  const handleMarkGroupRead = async (
    group: NotificationGroup,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    await markGroupRead(group);
  };

  const markGroupRead = async (
    group: NotificationGroup,
    options?: { silent?: boolean },
  ) => {
    const unreadItems = group.items.filter((notification) => !notification.isRead);

    if (unreadItems.length === 0) {
      return;
    }

    setIsMutating(true);
    setUnreadCount((current) => Math.max(0, current - unreadItems.length));
    setNotifications((current) =>
      current.map((notification) =>
        unreadItems.some((item) => item.id === notification.id)
          ? {
              ...notification,
              isRead: true,
              readAt: notification.readAt ?? new Date().toISOString(),
            }
          : notification,
      ),
    );

    try {
      await notificationsApi.markGroupRead(group.entityType, group.entityId);
      if (!options?.silent) {
        await refreshNotifications();
      }
    } catch {
      setError('Unable to mark that notification group as read.');
      await refreshNotifications();
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearGroup = async (
    group: NotificationGroup,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    setIsMutating(true);
    const groupIds = new Set(group.items.map((notification) => notification.id));
    const notificationsBefore = notifications;
    const unreadBefore = unreadCount;

    setNotifications((current) =>
      current.filter((notification) => !groupIds.has(notification.id)),
    );
    setUnreadCount((current) => Math.max(0, current - group.unreadCount));
    setExpandedGroups((current) => {
      const next = new Set(current);
      next.delete(group.key);
      return next;
    });

    try {
      await notificationsApi.clearGroup(group.entityType, group.entityId);
    } catch {
      setNotifications(notificationsBefore);
      setUnreadCount(unreadBefore);
      setError('Unable to clear that notification group.');
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
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
        <div className="fixed inset-x-3 top-16 z-50 max-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/15 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[28rem] dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/40">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">
                  Notifications
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                    : 'You are all caught up'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <HeaderIconButton
                  label="Refresh notifications"
                  disabled={isLoading || isRefreshing}
                  onClick={() =>
                    void refreshNotifications({ showSpinner: true })
                  }
                >
                  <RefreshCw
                    className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                  />
                </HeaderIconButton>
                <HeaderIconButton
                  label="Mark all as read"
                  disabled={isMutating || unreadCount === 0}
                  onClick={handleMarkAllRead}
                  className="text-[#0f6fb7] hover:bg-sky-50 hover:text-[#0b5f9e] dark:text-sky-300 dark:hover:bg-sky-950/30"
                >
                  <CheckCheck className="h-4 w-4" />
                </HeaderIconButton>
                <HeaderIconButton
                  label="Clear all notifications"
                  disabled={isMutating || notifications.length === 0}
                  onClick={handleClearAll}
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="h-4 w-4" />
                </HeaderIconButton>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-white p-1 shadow-inner shadow-slate-950/[0.03] dark:bg-slate-950">
              {NOTIFICATION_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => handleFilterChange(filter.id)}
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-xs font-semibold transition',
                    activeFilter === filter.id
                      ? 'bg-[#ff5a00] text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[calc(100vh-13rem)] overflow-y-auto p-2 sm:max-h-[31rem]">
            {isLoading ? (
              <NotificationLoadingState />
            ) : error ? (
              <NotificationErrorState
                message={error}
                onRetry={() => void refreshNotifications({ showSpinner: true })}
              />
            ) : groups.length === 0 ? (
              <NotificationEmptyState filter={activeFilter} />
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <NotificationGroupCard
                    key={group.key}
                    group={group}
                    isExpanded={expandedGroups.has(group.key)}
                    isMutating={isMutating}
                    onToggle={() => toggleGroup(group)}
                    onOpen={(event) => {
                      event.stopPropagation();
                      void handleOpenGroup(group);
                    }}
                    onMarkRead={(event) =>
                      void handleMarkGroupRead(group, event)
                    }
                    onClear={(event) => void handleClearGroup(group, event)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderIconButton({
  children,
  className,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 rounded-lg px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function NotificationGroupCard({
  group,
  isExpanded,
  isMutating,
  onClear,
  onMarkRead,
  onOpen,
  onToggle,
}: {
  group: NotificationGroup;
  isExpanded: boolean;
  isMutating: boolean;
  onClear: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onMarkRead: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onOpen: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onToggle: () => void;
}) {
  const isUnread = group.unreadCount > 0;
  const Icon = getNotificationIcon(group.latest);
  const isGrouped = group.items.length > 1;
  const latestMessage = formatNotificationMessage(group.latest);
  const latestContext = getNotificationContext(group.latest);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'w-full cursor-pointer overflow-hidden rounded-xl border text-left transition hover:bg-orange-50/60 dark:hover:bg-slate-900',
        isUnread
          ? 'border-orange-200 bg-orange-50/80 shadow-sm shadow-orange-950/[0.04] dark:border-orange-900/50 dark:bg-orange-950/20'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
      )}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="flex items-start gap-3 px-3 py-3">
        <div
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            getNotificationIconTone(group.latest),
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <p className="max-w-full truncate text-sm font-semibold text-slate-950 dark:text-white">
                  {group.latest.title}
                </p>
                {isGrouped ? (
                  <Badge
                    variant="neutral"
                    className="rounded-full px-2 py-0.5 text-[10px]"
                  >
                    {group.items.length} updates
                  </Badge>
                ) : null}
                {isUnread ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-[#ff5a00]/30 bg-white px-2 py-0.5 text-[10px] text-[#d94d00] dark:bg-slate-950 dark:text-orange-300"
                  >
                    {group.unreadCount === 1
                      ? 'New'
                      : `${group.unreadCount} new`}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {getEntityLabel(group.latest)}
              </p>
              {latestContext ? (
                <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {latestContext}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
              className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white',
                isGrouped ? 'opacity-100' : 'opacity-0',
              )}
              tabIndex={isGrouped ? 0 : -1}
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  isExpanded && 'rotate-180',
                )}
              />
            </button>
          </div>

          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {latestMessage}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <time
              className="text-[11px] text-slate-400 dark:text-slate-500"
              title={formatDateTime(group.latest.createdAt)}
            >
              {formatRelativeTime(group.latest.createdAt)}
            </time>
            <div className="flex items-center gap-1">
              <NotificationActionButton
                label="Open linked record"
                onClick={onOpen}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </NotificationActionButton>
              <NotificationActionButton
                label="Mark group as read"
                onClick={onMarkRead}
                disabled={isMutating || !isUnread}
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </NotificationActionButton>
              <NotificationActionButton
                label="Clear group"
                onClick={onClear}
                disabled={isMutating}
                className="hover:text-rose-600"
              >
                <X className="h-3.5 w-3.5" />
              </NotificationActionButton>
            </div>
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="space-y-2">
            {group.items.map((notification) => (
              <NotificationTimelineItem
                key={notification.id}
                notification={notification}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationTimelineItem({
  notification,
}: {
  notification: AppNotification;
}) {
  const context = getNotificationContext(notification);

  return (
    <div className="grid grid-cols-[0.75rem_1fr] gap-2 rounded-lg px-1 py-1.5">
      <span
        className={cn(
          'mt-1.5 h-2 w-2 rounded-full',
          notification.isRead ? 'bg-slate-300' : 'bg-[#ff5a00]',
        )}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {notification.title}
        </p>
        {context ? (
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {context}
          </p>
        ) : null}
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {formatNotificationMessage(notification)}
        </p>
        <time
          className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500"
          title={formatDateTime(notification.createdAt)}
        >
          {formatRelativeTime(notification.createdAt)}
        </time>
      </div>
    </div>
  );
}

function NotificationActionButton({
  children,
  className,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NotificationLoadingState() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-900" />
              <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-slate-900" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200">
      <p>{message}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-8 border-rose-200 bg-white text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-slate-950 dark:text-rose-200"
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  );
}

function NotificationEmptyState({ filter }: { filter: NotificationFilter }) {
  const message =
    filter === 'unread'
      ? 'No unread notifications.'
      : filter === 'orders'
        ? 'No order notifications.'
        : filter === 'shipments'
          ? 'No shipment notifications.'
          : 'No notifications yet.';

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
      {message}
    </div>
  );
}

function buildNotificationGroups(
  notifications: AppNotification[],
): NotificationGroup[] {
  const groups = new Map<string, AppNotification[]>();

  notifications.forEach((notification) => {
    const key = `${notification.entityType}:${notification.entityId}`;
    const group = groups.get(key) ?? [];

    group.push(notification);
    groups.set(key, group);
  });

  return [...groups.entries()]
    .map(([key, items]) => {
      const sortedItems = [...items].sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      );
      const latest = sortedItems[0];

      return {
        key,
        entityType: latest.entityType,
        entityId: latest.entityId,
        latest,
        items: sortedItems,
        unreadCount: sortedItems.filter((notification) => !notification.isRead)
          .length,
      };
    })
    .sort(
      (first, second) =>
        new Date(second.latest.createdAt).getTime() -
        new Date(first.latest.createdAt).getTime(),
    );
}

function filterNotifications(
  notifications: AppNotification[],
  filter: NotificationFilter,
): AppNotification[] {
  if (filter === 'orders') {
    return notifications.filter(
      (notification) => notification.entityType === 'ORDER',
    );
  }

  if (filter === 'shipments') {
    return notifications.filter(
      (notification) => notification.entityType === 'SHIPMENT',
    );
  }

  return notifications;
}

function getNotificationIcon(notification: AppNotification) {
  if (notification.type.includes('NOTE')) {
    return MessageSquare;
  }

  if (notification.entityType === 'SHIPMENT') {
    return Truck;
  }

  if (notification.entityType === 'ORDER') {
    return ShoppingCart;
  }

  return Bell;
}

function getNotificationIconTone(notification: AppNotification) {
  if (notification.type.includes('NOTE')) {
    return 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200';
  }

  if (notification.entityType === 'SHIPMENT') {
    return 'bg-sky-50 text-[#0f6fb7] dark:bg-sky-950/30 dark:text-sky-200';
  }

  if (notification.entityType === 'ORDER') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200';
  }

  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}

function getEntityLabel(notification: AppNotification) {
  if (notification.entityType === 'SHIPMENT') {
    return 'Shipment';
  }

  if (notification.entityType === 'ORDER') {
    return 'Order';
  }

  return 'Notification';
}

function getNotificationContext(notification: AppNotification): string | null {
  const context = extractTrailingContext(notification.message);

  if (context) {
    return context;
  }

  return null;
}

function formatNotificationMessage(notification: AppNotification): string {
  const messageWithoutContext = removeTrailingContext(notification.message);

  if (notification.entityType !== 'SHIPMENT') {
    return messageWithoutContext;
  }

  const statusMatch = messageWithoutContext.match(
    /^Shipment\s+\S+\s+for\s+(\S+)\s+changed from\s+(.+)\.$/,
  );

  if (statusMatch) {
    return `${statusMatch[1]} changed from ${statusMatch[2]}.`;
  }

  const createdMatch = messageWithoutContext.match(
    /^Shipment\s+\S+\s+was created for order\s+(\S+)\.$/,
  );

  if (createdMatch) {
    return `${createdMatch[1]} shipment was created.`;
  }

  const activityMatch = messageWithoutContext.match(
    /^(.+?)\s+Shipment\s+\S+\s+for order\s+(\S+)\.$/,
  );

  if (activityMatch) {
    return `${activityMatch[1]} ${activityMatch[2]}.`;
  }

  return messageWithoutContext;
}

function extractTrailingContext(message: string): string | null {
  const match = message.match(/\s+(Sale\s+.+)$/);

  return match ? match[1] : null;
}

function removeTrailingContext(message: string): string {
  return message.replace(/\s+Sale\s+.+$/, '').trim();
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return formatDateTime(value);
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (elapsedSeconds < 60) {
    return 'Just now';
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays}d ago`;
  }

  return formatDateTime(value);
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
