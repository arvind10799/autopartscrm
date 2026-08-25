'use client';

import Image from 'next/image';
import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn';
import { getNavigationForRole } from '@/features/auth/lib/permissions';
import type { UserRole } from '@/features/auth/types/auth.types';
import {
  APP_SIDEBAR_COLLAPSED_WIDTH,
  APP_SIDEBAR_WIDTH,
} from './shell.constants';

export function AppSidebar({
  role,
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
}: {
  role: UserRole;
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const navigationItems = getNavigationForRole(role);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm transition lg:hidden',
          isOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="crm-sidebar"
        aria-label="CRM sidebar navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sky-200/80 bg-[linear-gradient(180deg,#eff8ff_0%,#e6f3ff_46%,#f8fbff_100%)] px-3 py-5 text-slate-900 shadow-2xl shadow-sky-950/10 transition-[width,transform,box-shadow,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,transform] dark:border-slate-800 dark:bg-[linear-gradient(180deg,#071326_0%,#0b172a_48%,#020617_100%)] dark:text-slate-100 dark:shadow-black/30',
          'w-[min(15rem,calc(100vw-1rem))]',
          'lg:translate-x-0 lg:shadow-none',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          width: undefined,
        }}
      >
        {/* Desktop: override width based on collapsed state */}
        <style>{`
          @media (min-width: 1024px) {
            #crm-sidebar {
              width: ${isCollapsed ? APP_SIDEBAR_COLLAPSED_WIDTH : APP_SIDEBAR_WIDTH} !important;
              transform: translateX(0) !important;
            }
          }
        `}</style>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            isCollapsed ? 'overflow-visible' : 'overflow-hidden',
          )}
        >
          <div
            className={cn(
              'relative flex items-center rounded-[1.35rem] border border-white/85 bg-white/80 shadow-sm shadow-sky-900/5 ring-1 ring-sky-100/80 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-700/70 dark:bg-slate-950/55 dark:shadow-black/20 dark:ring-slate-700/60',
              isCollapsed
                ? 'justify-center px-2 py-3'
                : 'min-h-[6.25rem] justify-center px-4 py-5',
            )}
          >
            <Link
              href="/dashboard"
              onClick={onClose}
              className={cn(
                'flex min-w-0 items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                isCollapsed
                  ? 'h-11 w-11 overflow-hidden rounded-xl bg-white/90 p-1.5 dark:bg-white/95'
                  : 'w-full',
              )}
              aria-label="Mee Auto Parts"
              title="Mee Auto Parts"
            >
              <Image
                src="/images/mee-auto-parts-sidebar-logo.png"
                alt="Mee Auto Parts"
                width={631}
                height={247}
                priority
                className={cn(
                  'object-contain transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  isCollapsed
                    ? 'h-full w-full scale-[2.6] object-left'
                    : 'h-auto w-full max-w-[12.5rem]',
                )}
              />
            </Link>

            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 shrink-0 text-sky-700 hover:bg-sky-100 hover:text-sky-950 dark:text-sky-300 dark:hover:bg-slate-800 dark:hover:text-sky-100 lg:hidden"
              onClick={onClose}
              aria-label="Close navigation menu"
              type="button"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>

            {/* Desktop collapse/expand button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 hidden shrink-0 text-sky-700 hover:bg-sky-100 hover:text-sky-950 dark:text-sky-300 dark:hover:bg-slate-800 dark:hover:text-sky-100 lg:flex"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              type="button"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Separator className="my-4 bg-sky-200/80 dark:bg-slate-800" />

          <nav
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-1',
              isCollapsed
                ? 'overflow-visible pr-0'
                : 'overflow-y-auto overflow-x-hidden pr-1',
            )}
          >
            {navigationItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={isCollapsed ? item.label : undefined}
                  className={cn(
                    'group relative flex items-center overflow-visible rounded-xl border text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    isCollapsed
                      ? 'justify-center px-2 py-2.5'
                      : 'gap-2.5 px-3 py-2.5',
                    isActive
                      ? 'border-sky-300/80 bg-white text-sky-800 shadow-sm shadow-sky-900/5 ring-1 ring-sky-200/70 dark:border-sky-500/40 dark:bg-sky-950/45 dark:text-sky-100 dark:ring-sky-500/20'
                      : 'border-transparent text-slate-600 hover:border-sky-200/80 hover:bg-white/60 hover:text-sky-950 hover:shadow-sm hover:shadow-sky-900/5 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/70 dark:hover:text-sky-100',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.45)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                      isActive
                        ? 'scale-y-100 opacity-100'
                        : 'scale-y-50 opacity-0',
                    )}
                  />
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-105',
                      isActive
                        ? 'bg-sky-100 text-sky-700 shadow-sm ring-1 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/25'
                        : 'bg-white/45 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-700 dark:bg-slate-900/60 dark:text-slate-400 dark:group-hover:bg-sky-500/15 dark:group-hover:text-sky-200',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {!isCollapsed && (
                    <span className="truncate transition-all duration-300">
                      {item.label}
                    </span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <span className="pointer-events-none invisible absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl shadow-slate-950/25 ring-1 ring-white/10 backdrop-blur transition-all duration-200 before:absolute before:-left-1 before:top-1/2 before:h-2 before:w-2 before:-translate-y-1/2 before:rotate-45 before:border-b before:border-l before:border-slate-700/80 before:bg-slate-950/95 lg:group-hover:visible lg:group-hover:translate-x-0 lg:group-hover:opacity-100">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <Separator className="my-4 bg-sky-200/80 dark:bg-slate-800" />

          <div className="mt-auto border-t border-sky-200/80 pt-4 text-center dark:border-slate-800">
            {isCollapsed ? (
              <p
                className="text-[10px] font-semibold leading-tight text-slate-500 dark:text-slate-400"
                title="Auto Parts CRM Version 2.0.0 © Intracia Technologies"
              >
                CRM
              </p>
            ) : (
              <div className="space-y-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                <p className="font-semibold text-slate-600 dark:text-slate-300">Auto Parts CRM</p>
                <p>Version 2.0.0</p>
                <p>© Intracia Technologies</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
