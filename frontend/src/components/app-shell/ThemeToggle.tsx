'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme, type ThemeMode } from '@/lib/theme/theme-provider';
import { cn } from '@/lib/utils/cn';

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright CRM workspace',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low-light CRM workspace',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follow this device',
    icon: Monitor,
  },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeOption =
    THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-10 w-10 rounded-full border-slate-200 bg-white px-0 font-semibold text-slate-900 shadow-sm hover:border-[#ff5a00]/35 hover:bg-orange-50 hover:text-[#ff5a00] sm:w-auto sm:px-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-orange-950/20 dark:hover:text-orange-300"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Theme: ${activeOption.label}`}
      >
        <ActiveIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{activeOption.label}</span>
      </Button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-950 shadow-2xl shadow-slate-950/15 ring-1 ring-white/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:shadow-black/40"
        >
          <div className="px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Appearance
            </p>
          </div>

          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = option.value === theme;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
                  isActive
                    ? 'bg-orange-50 text-[#d94d00] dark:bg-orange-950/25 dark:text-orange-300'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white',
                )}
                onClick={() => {
                  setTheme(option.value);
                  setIsOpen(false);
                }}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                    isActive
                      ? 'border-[#ff5a00]/25 bg-white text-[#ff5a00] dark:bg-slate-950 dark:text-orange-300'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{option.label}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {option.description}
                  </span>
                </span>
                {isActive ? (
                  <span className="h-2 w-2 rounded-full bg-[#ff5a00]" />
                ) : null}
              </button>
            );
          })}

          <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Active: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
