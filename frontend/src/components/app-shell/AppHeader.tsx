'use client';

import { LogOut, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { authApi } from '@/features/auth/api/auth-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { roleLabels } from '@/features/auth/lib/roles';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type { AuthUser } from '@/features/auth/types/auth.types';
import { APP_SHELL_MAX_WIDTH } from './shell.constants';

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
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isPending, startTransition] = useTransition();

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
    <header className="sticky top-0 z-20 border-b border-border/70 bg-[rgba(249,250,252,0.88)] backdrop-blur-xl">
      <div
        className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8"
        style={{ maxWidth: APP_SHELL_MAX_WIDTH }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 lg:hidden"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            aria-controls="crm-sidebar"
            aria-expanded={isMenuOpen}
            type="button"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <h1 className="truncate text-sm font-semibold text-foreground">
            {currentSection}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user.role === 'SALES' ? (
            <div className="hidden min-w-0 sm:flex sm:max-w-64 sm:flex-col sm:items-end">
              <span className="truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          ) : null}

          <Badge variant="neutral" className="hidden sm:inline-flex">
            {roleLabels[user.role]}
          </Badge>

          <Button variant="outline" size="sm" onClick={handleLogout} disabled={isPending}>
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
