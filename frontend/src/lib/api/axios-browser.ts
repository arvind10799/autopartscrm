'use client';

import axios from 'axios';
import { clientEnv } from '@/lib/config/env.client';
import { LOGIN_ROUTE } from '@/features/auth/constants/auth-routes';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { toHttpError } from './http-error';

export const axiosBrowser = axios.create({
  baseURL: '',
  timeout: clientEnv.NEXT_PUBLIC_API_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosBrowser.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalizedError = toHttpError(error);
    const requestUrl = typeof error?.config?.url === 'string' ? error.config.url : '';
    const isAuthRoute = requestUrl.startsWith('/api/auth/');

    if (
      typeof window !== 'undefined' &&
      normalizedError.status === 401 &&
      window.location.pathname !== LOGIN_ROUTE &&
      !isAuthRoute
    ) {
      useAuthStore.getState().clearSession();
      window.location.assign(LOGIN_ROUTE);
    }

    return Promise.reject(normalizedError);
  },
);
