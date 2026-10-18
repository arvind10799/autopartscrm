'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  DATE_RANGE_PRESETS,
  createDefaultDateRangeFilterState,
  type DateRangeFilterState,
  type DateRangePreset,
} from './date-range';

function updateTableUrl(changes: Record<string, string | null>, resetPage = false) {
  const url = new URL(window.location.href);

  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }

  if (resetPage) {
    url.searchParams.delete('page');
  }

  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function useTableQueryParam<T extends string | number | null>(
  key: string,
  fallback: T,
  parse: (raw: string) => T,
  resetPage = true,
): [T, Dispatch<SetStateAction<T>>] {
  const searchParams = useSearchParams();
  const raw = searchParams.get(key);
  const value = raw === null ? fallback : parse(raw);

  const setValue: Dispatch<SetStateAction<T>> = (next) => {
    const currentRaw = new URLSearchParams(window.location.search).get(key);
    const current = currentRaw === null ? fallback : parse(currentRaw);
    const resolved = typeof next === 'function'
      ? (next as (previous: T) => T)(current)
      : next;
    updateTableUrl(
      { [key]: resolved === fallback || resolved === null ? null : String(resolved) },
      resetPage,
    );
  };

  return [value, setValue];
}

export function parseTablePage(raw: string): number {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

export function useTableDateRange(): [DateRangeFilterState, (value: DateRangeFilterState) => void] {
  const searchParams = useSearchParams();
  const presetRaw = searchParams.get('datePreset');
  const preset: DateRangePreset = DATE_RANGE_PRESETS.includes(presetRaw as DateRangePreset)
    ? (presetRaw as DateRangePreset)
    : 'ALL';
  const defaultState = createDefaultDateRangeFilterState();
  const value: DateRangeFilterState = {
    preset,
    from: searchParams.get('dateFrom') ?? defaultState.from,
    to: searchParams.get('dateTo') ?? defaultState.to,
  };

  const setValue = (next: DateRangeFilterState) => {
    updateTableUrl({
      datePreset: next.preset === 'ALL' ? null : next.preset,
      dateFrom: next.preset === 'CUSTOM' ? next.from : null,
      dateTo: next.preset === 'CUSTOM' ? next.to : null,
    }, true);
  };

  return [value, setValue];
}

export function useTableDetailHref(listPath: string): (detailPath: string) => string {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const listHref = `${listPath}${query ? `?${query}` : ''}`;
  return (detailPath) => `${detailPath}?returnTo=${encodeURIComponent(listHref)}`;
}

export function getDetailReturnHref(search: string, fallback: string): string {
  const returnTo = new URLSearchParams(search).get('returnTo');
  if (!returnTo || !/^\/(leads|website-leads|orders|shipments|replacement-orders)(?:\?|$)/.test(returnTo)) {
    return fallback;
  }

  return returnTo;
}

export function getTableBackLabel(href: string): string | null {
  if (href.startsWith('/leads')) return 'Back to leads';
  if (href.startsWith('/website-leads')) return 'Back to website leads';
  if (href.startsWith('/orders')) return 'Back to orders';
  if (href.startsWith('/shipments')) return 'Back to shipments';
  if (href.startsWith('/replacement-orders')) return 'Back to replacement orders';
  return null;
}

export function useDetailReturnHref(fallback: string): string {
  const pathname = usePathname();
  const [href, setHref] = useState(fallback);

  useEffect(() => {
    setHref(getDetailReturnHref(window.location.search, fallback));
  }, [fallback, pathname]);

  return href;
}
