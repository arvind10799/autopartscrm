'use client';

import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import {
  APP_SHELL_MAX_WIDTH,
  APP_SIDEBAR_COLLAPSED_WIDTH,
  APP_SIDEBAR_WIDTH,
} from './shell.constants';
import { getNavigationForRole } from '@/features/auth/lib/permissions';
import type { AuthUser } from '@/features/auth/types/auth.types';
import { matchNavigationItem } from '@/lib/config/navigation';

const fallbackSection = {
  label: 'Workspace',
  description: 'Role-aware operational workspace.',
};

const SIDEBAR_COLLAPSED_KEY = 'crm-sidebar-collapsed';

function getStoredCollapsedState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AppShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigationItems = useMemo(
    () => getNavigationForRole(user.role),
    [user.role],
  );
  const currentNavigationItem =
    navigationItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ??
    matchNavigationItem(pathname);
  const currentSection = currentNavigationItem ?? fallbackSection;

  // Hydrate collapsed state from localStorage on mount
  useEffect(() => {
    setSidebarCollapsed(getStoredCollapsedState());
  }, []);

  const handleToggleCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]);

  const activeSidebarWidth = sidebarCollapsed
    ? APP_SIDEBAR_COLLAPSED_WIDTH
    : APP_SIDEBAR_WIDTH;

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,248,252,0.98))]"
      style={
        {
          '--app-shell-max-width': APP_SHELL_MAX_WIDTH,
          '--app-sidebar-width': activeSidebarWidth,
        } as CSSProperties
      }
    >
      <AppSidebar
        role={user.role}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="min-h-screen transition-[padding] duration-200 ease-out lg:pl-[var(--app-sidebar-width)]">
        <div className="flex min-h-screen flex-col">
          <AppHeader
            user={user}
            currentSection={currentSection.label}
            onOpenMenu={() => setSidebarOpen(true)}
            isMenuOpen={sidebarOpen}
          />

          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="mx-auto flex w-full max-w-[var(--app-shell-max-width)] min-w-0 flex-col gap-6">
              <div className="min-w-0">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
