import { createValidatedEnv } from '@/lib/utils/create-env';
import { serverEnvSchema } from './env.shared';

const serverEnv = createValidatedEnv(
  serverEnvSchema,
  {
    BACKEND_API_URL: process.env.BACKEND_API_URL,
    BACKEND_API_TIMEOUT_MS: process.env.BACKEND_API_TIMEOUT_MS,
    AUTH_COOKIE_MAX_AGE_SECONDS: process.env.AUTH_COOKIE_MAX_AGE_SECONDS,
    AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
  },
  'server',
);

export function getBackendApiUrl(): string {
  return serverEnv.BACKEND_API_URL.replace(/\/$/, '');
}

export function getBackendApiTimeoutMs(): number {
  return serverEnv.BACKEND_API_TIMEOUT_MS;
}

export function getAuthCookieMaxAgeSeconds(): number {
  return serverEnv.AUTH_COOKIE_MAX_AGE_SECONDS;
}

export function getAuthCookieSecure(): boolean {
  if (serverEnv.AUTH_COOKIE_SECURE !== undefined) {
    return serverEnv.AUTH_COOKIE_SECURE;
  }

  return process.env.NODE_ENV === 'production';
}
