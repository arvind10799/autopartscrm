import { createValidatedEnv } from '@/lib/utils/create-env';
import { clientEnvSchema } from './env.shared';

export const clientEnv = createValidatedEnv(
  clientEnvSchema,
  {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
    NEXT_PUBLIC_TOAST_DURATION_MS: process.env.NEXT_PUBLIC_TOAST_DURATION_MS,
  },
  'client',
);
