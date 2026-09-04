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
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#f36f3d]/20 bg-[linear-gradient(180deg,#fff7f2_0%,#edf7fb_46%,#f8fbff_100%)] px-2 py-3.5 text-slate-900 shadow-2xl shadow-sky-950/10 transition-[width,transform,box-shadow,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,transform] dark:border-[#f36f3d]/15 dark:bg-[linear-gradient(180deg,#071326_0%,#0b172a_48%,#020617_100%)] dark:text-slate-100 dark:shadow-black/30',
          'w-[min(13rem,calc(100vw-1rem))]',
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
              'relative flex items-center rounded-[1.15rem] border border-white/85 bg-white/80 shadow-sm shadow-sky-900/5 ring-1 ring-[#1f5b70]/10 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-700/70 dark:bg-slate-950/55 dark:shadow-black/20 dark:ring-[#f36f3d]/15',
              isCollapsed
                ? 'justify-center px-1 py-2'
                : 'min-h-[4.75rem] justify-center px-3 py-3.5',
            )}
          >
            <Link
              href="/dashboard"
              onClick={onClose}
              className={cn(
                'flex min-w-0 items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                isCollapsed
                  ? 'h-9 w-9 overflow-hidden rounded-xl bg-white/90 p-1.5 dark:bg-white/95'
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
                    : 'h-auto w-full max-w-[10.6rem]',
                )}
              />
            </Link>

            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1.5 top-1.5 h-8 w-8 shrink-0 text-[#1f5b70] hover:bg-[#f36f3d]/10 hover:text-[#f36f3d] dark:text-sky-200 dark:hover:bg-[#f36f3d]/15 dark:hover:text-orange-200 lg:hidden"
              onClick={onClose}
              aria-label="Close navigation menu"
              type="button"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop collapse/expand button */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'absolute -right-3 top-14 z-50 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#1f5b70]/20 bg-white p-0 text-[#1f5b70] shadow-md shadow-slate-900/10 ring-2 ring-white/80 transition-all duration-300 hover:-right-3.5 hover:border-[#f36f3d]/40 hover:bg-[#fff7f2] hover:text-[#f36f3d] focus-visible:ring-[#f36f3d]/35 dark:border-[#f36f3d]/25 dark:bg-slate-950 dark:text-sky-200 dark:ring-slate-950/80 dark:hover:bg-[#f36f3d]/15 dark:hover:text-orange-200 lg:flex',
              isCollapsed ? 'top-10' : 'top-16',
            )}
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </Button>

          <Separator className="my-2.5 bg-[#1f5b70]/15 dark:bg-slate-800" />

          <nav
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-0.5',
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
                      ? 'justify-center px-2 py-2'
                      : 'gap-2 px-2 py-1.5',
                    isActive
                      ? 'border-[#1f5b70]/20 bg-white text-[#123f52] shadow-sm shadow-sky-900/5 ring-1 ring-[#f36f3d]/25 dark:border-[#f36f3d]/25 dark:bg-[#123f52]/35 dark:text-orange-100 dark:ring-[#f36f3d]/20'
                      : 'border-transparent text-slate-600 hover:border-[#1f5b70]/15 hover:bg-white/65 hover:text-[#123f52] hover:shadow-sm hover:shadow-sky-900/5 dark:text-slate-300 dark:hover:border-[#f36f3d]/15 dark:hover:bg-slate-800/70 dark:hover:text-orange-100',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#f36f3d] shadow-[0_0_16px_rgba(243,111,61,0.42)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                      isActive
                        ? 'scale-y-100 opacity-100'
                        : 'scale-y-50 opacity-0',
                    )}
                  />
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-105',
                      isActive
                        ? 'bg-[#f36f3d]/12 text-[#f36f3d] shadow-sm ring-1 ring-[#f36f3d]/25 dark:bg-[#f36f3d]/15 dark:text-orange-200 dark:ring-[#f36f3d]/25'
                        : 'bg-white/45 text-slate-500 group-hover:bg-[#1f5b70]/10 group-hover:text-[#1f5b70] dark:bg-slate-900/60 dark:text-slate-400 dark:group-hover:bg-[#f36f3d]/15 dark:group-hover:text-orange-200',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {!isCollapsed && (
                    <span className="truncate text-[0.92rem] transition-all duration-300">
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

          <Separator className="my-2.5 bg-[#1f5b70]/15 dark:bg-slate-800" />

          <div className="mt-auto border-t border-[#1f5b70]/15 pt-2.5 text-center dark:border-slate-800">
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
