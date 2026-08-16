import { buildApiEnvelope, parseApiEnvelope } from '@/lib/api/api-envelope';
import { API_ERROR_MESSAGES } from '@/lib/constants/api';
import { getBackendApiTimeoutMs, getBackendApiUrl } from '@/lib/config/env.server';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';

export type BackendRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  accessToken?: string | null;
  body?: unknown;
  timeoutMs?: number;
  forwardedHeaders?: Headers;
};

export type BackendApiResult<T> = {
  status: number;
  payload: ApiEnvelope<T>;
};

export async function requestBackend<T>(
  path: string,
  options: BackendRequestOptions = {},
): Promise<BackendApiResult<T>> {
  const { method = 'GET', accessToken, body, timeoutMs, forwardedHeaders } = options;

  const headers = new Headers({
    Accept: 'application/json',
  });
  copyForwardedIpHeaders(headers, forwardedHeaders);

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  try {
    const response = await fetch(`${getBackendApiUrl()}${path}`, {
      method,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs ?? getBackendApiTimeoutMs()),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const rawPayload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);
    const payload =
      parseApiEnvelope<T>(rawPayload) ??
      buildApiEnvelope<T>(
        response.ok
          ? 'Request completed successfully.'
          : API_ERROR_MESSAGES.unexpectedResponse,
      );

    return {
      status: response.status,
      payload,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'TimeoutError'
        ? API_ERROR_MESSAGES.timeout
        : API_ERROR_MESSAGES.network;

    return {
      status: error instanceof Error && error.name === 'TimeoutError' ? 504 : 503,
      payload: buildApiEnvelope<T>(message),
    };
  }
}

function copyForwardedIpHeaders(targetHeaders: Headers, sourceHeaders?: Headers) {
  if (!sourceHeaders) {
    return;
  }

  const forwardedFor = sourceHeaders.get('x-forwarded-for');
  const realIp = sourceHeaders.get('x-real-ip');
  const forwardedProto = sourceHeaders.get('x-forwarded-proto');

  if (forwardedFor) {
    targetHeaders.set('X-Forwarded-For', forwardedFor);
  }

  if (realIp) {
    targetHeaders.set('X-Real-IP', realIp);
  } else if (forwardedFor) {
    targetHeaders.set('X-Real-IP', forwardedFor.split(',')[0]?.trim() ?? forwardedFor);
  }

  if (forwardedProto) {
    targetHeaders.set('X-Forwarded-Proto', forwardedProto);
  }
}
