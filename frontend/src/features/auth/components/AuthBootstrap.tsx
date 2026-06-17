'use client';

import { useEffect } from 'react';
import { HttpError } from '@/lib/api/http-error';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { authApi } from '../api/auth-api';
import { useAuthStore } from '../store/auth.store';

export function AuthBootstrap() {
  const initialized = useAuthStore((state) => state.initialized);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const requestTracker = useRequestTracker();

  useEffect(() => {
    if (initialized) {
      return;
    }

    const requestId = requestTracker.beginRequest();

    const loadSession = async () => {
      setLoading();

      try {
        const session = await authApi.getSession();

        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setSession(session);
      } catch (error) {
        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        if (error instanceof HttpError && error.status === 401) {
          clearSession();
          return;
        }

        clearSession();
      }
    };

    void loadSession();
  }, [clearSession, initialized, requestTracker, setLoading, setSession]);

  return null;
}
