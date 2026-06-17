import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/features/auth/lib/auth-session';
import { buildApiEnvelope } from './api-envelope';
import { requestBackend, type BackendRequestOptions } from './backend-api';

export function buildNoStoreJsonResponse<T>(payload: T, status: number) {
  const response = NextResponse.json(payload, { status });
  response.headers.set('Cache-Control', 'no-store');

  return response;
}

export function buildUnauthorizedApiResponse(message = 'Authentication required.') {
  return buildNoStoreJsonResponse(buildApiEnvelope(message), 401);
}

export async function proxyBackendWithSession<T>(
  path: string,
  options: Omit<BackendRequestOptions, 'accessToken'> = {},
) {
  const session = readSessionFromCookies(await cookies());

  if (!session.accessToken) {
    return buildUnauthorizedApiResponse();
  }

  const { status, payload } = await requestBackend<T>(path, {
    ...options,
    accessToken: session.accessToken,
  });

  return buildNoStoreJsonResponse(payload, status || 500);
}
