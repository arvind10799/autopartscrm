'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { UserRole } from '@/features/auth/types/auth.types';
import { websiteLeadsApi, type WebsiteLeadSummary } from './website-leads-api';

const REFRESH_INTERVAL_MS = 60_000;

type SummaryContext = {
  summary: WebsiteLeadSummary | null;
  refresh: () => Promise<void>;
};

const WebsiteLeadsSummaryContext = createContext<SummaryContext | null>(null);

export function WebsiteLeadsSummaryProvider({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const [summary, setSummary] = useState<WebsiteLeadSummary | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback((): Promise<void> => {
    if (role !== 'ADMIN' && role !== 'SALES') return Promise.resolve();
    if (inFlight.current) return inFlight.current;
    const request = websiteLeadsApi
      .summary()
      .then((result) => {
        if (mounted.current) setSummary(result);
      })
      .catch(() => {
        // Keep the last known count if a background refresh fails.
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = request;
    return request;
  }, [role]);

  useEffect(() => {
    mounted.current = true;
    if (role !== 'ADMIN' && role !== 'SALES') return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    refreshWhenVisible();
    const interval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh, role]);

  return (
    <WebsiteLeadsSummaryContext.Provider value={{ summary, refresh }}>
      {children}
    </WebsiteLeadsSummaryContext.Provider>
  );
}

export function useWebsiteLeadsSummary() {
  const context = useContext(WebsiteLeadsSummaryContext);
  if (!context) {
    throw new Error('Website lead summary must be used inside the app shell.');
  }
  return context;
}
