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
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sky-200/80 bg-[linear-gradient(180deg,#eff8ff_0%,#e6f3ff_46%,#f8fbff_100%)] px-3 py-5 text-slate-900 shadow-2xl shadow-sky-950/10 transition-all duration-200 ease-out',
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              'relative flex items-center rounded-[1.35rem] border border-white/85 bg-white/80 shadow-sm shadow-sky-900/5 ring-1 ring-sky-100/80',
              isCollapsed
                ? 'justify-center px-2 py-3'
                : 'min-h-[6.25rem] justify-center px-4 py-5',
            )}
          >
            <Link
              href="/dashboard"
              onClick={onClose}
              className={cn(
                'flex min-w-0 items-center justify-center',
                isCollapsed ? 'h-10 w-10 overflow-hidden rounded-xl bg-white' : 'w-full',
              )}
              aria-label="Mee Auto Parts"
              title="Mee Auto Parts"
            >
              <Image
                src="/images/logo.png"
                alt="Mee Auto Parts"
                width={224}
                height={72}
                priority
                className={cn(
                  'object-contain',
                  isCollapsed ? 'h-8 w-24 max-w-none' : 'h-auto w-full max-w-[11.5rem]',
                )}
              />
            </Link>

            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 shrink-0 text-sky-700 hover:bg-sky-100 hover:text-sky-950 lg:hidden"
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
              className="absolute right-2 top-2 hidden shrink-0 text-sky-700 hover:bg-sky-100 hover:text-sky-950 lg:flex"
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

          <Separator className="my-4 bg-sky-200/80" />

          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden pr-1">
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
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    'group relative flex items-center rounded-xl border text-sm font-medium transition',
                    isCollapsed
                      ? 'justify-center px-2 py-2.5'
                      : 'gap-2.5 px-3 py-2.5',
                    isActive
                      ? 'border-sky-300/80 bg-white text-sky-800 shadow-sm shadow-sky-900/5 ring-1 ring-sky-200/70'
                      : 'border-transparent text-slate-600 hover:border-sky-200/80 hover:bg-white/60 hover:text-sky-950 hover:shadow-sm hover:shadow-sky-900/5',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition',
                      isActive
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-white/45 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-700',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg lg:group-hover:block">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <Separator className="my-4 bg-sky-200/80" />

          <div className="mt-auto border-t border-sky-200/80 pt-4 text-center">
            {isCollapsed ? (
              <p
                className="text-[10px] font-semibold leading-tight text-slate-500"
                title="Auto Parts CRM Version 1.0.0 © Intracia Technologies"
              >
                CRM
              </p>
            ) : (
              <div className="space-y-1 text-[11px] leading-relaxed text-slate-500">
                <p className="font-semibold text-slate-600">Auto Parts CRM</p>
                <p>Version 1.0.0</p>
                <p>© Intracia Technologies</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
