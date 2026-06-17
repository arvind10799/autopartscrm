import { z } from 'zod';
import {
  APP_NAME,
  DEFAULT_APP_URL,
  DEFAULT_TOAST_DURATION_MS,
} from '@/lib/constants/app';
import {
  DEFAULT_API_TIMEOUT_MS,
  DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS,
  DEFAULT_BACKEND_API_URL,
} from '@/lib/constants/api';

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default(APP_NAME),
  NEXT_PUBLIC_APP_URL: z.string().url().default(DEFAULT_APP_URL),
  NEXT_PUBLIC_API_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_API_TIMEOUT_MS),
  NEXT_PUBLIC_TOAST_DURATION_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(30000)
    .default(DEFAULT_TOAST_DURATION_MS),
});

export const serverEnvSchema = z.object({
  BACKEND_API_URL: z.string().url().default(DEFAULT_BACKEND_API_URL),
  BACKEND_API_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_API_TIMEOUT_MS),
  AUTH_COOKIE_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS),
});
