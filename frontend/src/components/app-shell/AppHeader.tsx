'use client';

import Link from 'next/link';
import { ArrowLeft, LogOut, Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { authApi } from '@/features/auth/api/auth-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { roleLabels } from '@/features/auth/lib/roles';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type { AuthUser } from '@/features/auth/types/auth.types';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { APP_SHELL_MAX_WIDTH } from './shell.constants';
import { ThemeToggle } from './ThemeToggle';

export function AppHeader({
  user,
  currentSection,
  onOpenMenu,
  isMenuOpen,
}: {
  user: AuthUser;
  currentSection: string;
  onOpenMenu: () => void;
  isMenuOpen: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isPending, startTransition] = useTransition();
  const showOrdersBackLink = /^\/orders\/[^/]+/.test(pathname);

  const handleLogout = () => {
    startTransition(async () => {
      try {
        await authApi.logout();
      } finally {
        clearSession();
        router.replace('/login');
        router.refresh();
      }
    });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 shadow-sm shadow-slate-950/[0.03] backdrop-blur-xl transition-colors duration-300 dark:border-slate-800 dark:bg-[rgba(2,11,24,0.92)] dark:shadow-black/20">
      <div
        className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8"
        style={{ maxWidth: APP_SHELL_MAX_WIDTH }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 shrink-0 rounded-full border-slate-200 bg-white px-0 text-[#0f6fb7] shadow-sm hover:border-[#ff5a00]/35 hover:bg-orange-50 hover:text-[#ff5a00] lg:hidden dark:border-slate-800 dark:bg-slate-950 dark:text-sky-300 dark:hover:bg-orange-950/20 dark:hover:text-orange-300"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            aria-controls="crm-sidebar"
            aria-expanded={isMenuOpen}
            type="button"
          >
            <Menu className="h-4 w-4" />
          </Button>

          {showOrdersBackLink ? (
            <Link
              href="/orders"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0f6fb7] shadow-sm transition hover:border-[#ff5a00]/35 hover:bg-orange-50 hover:text-[#ff5a00] dark:border-slate-800 dark:bg-slate-950 dark:text-sky-300 dark:hover:bg-orange-950/20 dark:hover:text-orange-300"
              aria-label="Back to orders"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : null}

          <h1 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
            {currentSection}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user.role === 'SALES' ? (
            <div className="hidden min-w-0 sm:flex sm:max-w-64 sm:flex-col sm:items-end">
              <span className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                {user.name}
              </span>
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </span>
            </div>
          ) : null}

          <Badge
            variant="neutral"
            className="hidden rounded-full border-slate-200 bg-white px-3 py-1.5 text-slate-900 shadow-sm sm:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {roleLabels[user.role]}
          </Badge>

          <NotificationBell />

          <ThemeToggle />

          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-full border-slate-200 bg-white px-3 font-semibold text-slate-900 shadow-sm hover:border-[#ff5a00]/35 hover:bg-orange-50 hover:text-[#ff5a00] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-orange-950/20 dark:hover:text-orange-300"
            onClick={handleLogout}
            disabled={isPending}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isPending ? 'Signing out...' : 'Logout'}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
