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
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 bg-[linear-gradient(180deg,#062846_0%,#031f38_48%,#021426_100%)] px-2 py-3.5 text-white shadow-2xl shadow-sky-950/20 transition-[width,transform,box-shadow,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,transform] dark:border-white/10 dark:bg-[linear-gradient(180deg,#062846_0%,#031f38_48%,#021426_100%)] dark:text-white dark:shadow-black/30',
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
              'relative flex items-center rounded-[1.15rem] border border-white/10 bg-white/[0.03] shadow-sm shadow-black/10 ring-1 ring-white/10 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-black/20 dark:ring-white/10',
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
              className="absolute right-1.5 top-1.5 h-8 w-8 shrink-0 text-white/75 hover:bg-white/10 hover:text-white lg:hidden"
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
              'absolute -right-3 top-14 z-50 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#073052] p-0 text-white shadow-md shadow-slate-950/20 ring-2 ring-white/80 transition-all duration-300 hover:-right-3.5 hover:border-[#ff6a1a]/60 hover:bg-[#ff5a00] hover:text-white focus-visible:ring-[#ff6a1a]/35 lg:flex',
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

          <Separator className="my-2.5 bg-white/14" />

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
                      ? 'border-[#ff6a1a]/35 bg-[#ff5a00] text-white shadow-lg shadow-orange-950/20 ring-1 ring-white/10'
                      : 'border-transparent text-white/82 hover:border-white/10 hover:bg-white/8 hover:text-white',
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
                        ? 'bg-white/16 text-white shadow-sm ring-1 ring-white/15'
                        : 'bg-white/8 text-white/70 group-hover:bg-white/12 group-hover:text-white',
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

          <Separator className="my-2.5 bg-white/14" />

          <div className="mt-auto border-t border-white/14 pt-2.5 text-center">
            {isCollapsed ? (
              <p
                className="text-[10px] font-semibold leading-tight text-white/60"
                title="Auto Parts CRM Version 2.0.0 © Intracia Technologies"
              >
                CRM
              </p>
            ) : (
              <div className="space-y-1 text-[11px] leading-relaxed text-white/60">
                <p className="font-semibold text-white/80">Auto Parts CRM</p>
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
