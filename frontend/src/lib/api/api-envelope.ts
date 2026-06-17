import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import { isNonEmptyString, isRecord } from '@/lib/utils/guards';

export function buildApiEnvelope<T>(
  message: string,
  overrides?: Partial<ApiEnvelope<T>>,
): ApiEnvelope<T> {
  return {
    success: overrides?.success ?? false,
    data: overrides?.data ?? null,
    message,
  };
}

export function parseApiEnvelope<T>(value: unknown): ApiEnvelope<T> | null {
  if (!isRecord(value)) {
    return null;
  }

  const success =
    typeof value.success === 'boolean' ? value.success : undefined;
  const message =
    typeof value.message === 'string' ? value.message : undefined;

  if (success === undefined || message === undefined) {
    return null;
  }

  return {
    success,
    data: ('data' in value ? (value.data as T | null) : null) ?? null,
    message,
  };
}

export function parseResponseMessage(value: unknown): string | null {
  if (isNonEmptyString(value)) {
    return value.trim();
  }

  if (!isRecord(value)) {
    return null;
  }

  if (isNonEmptyString(value.message)) {
    return value.message.trim();
  }

  return null;
}
