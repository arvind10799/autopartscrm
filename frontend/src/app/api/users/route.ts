import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { requestBackend } from '@/lib/api/backend-api';
import {
  buildDateRangeSearchParams,
  readTimestampRangeQueryFromSearchParams,
} from '@/lib/filters/date-range';
import { AUTH_COOKIE_NAMES } from '@/features/auth/lib/auth-session';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null;

  if (!accessToken) {
    const response = NextResponse.json(
      buildApiEnvelope('Authentication required.'),
      { status: 401 },
    );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    const response = NextResponse.json(
      buildApiEnvelope('Invalid request body.'),
      { status: 400 },
    );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const { status, payload } = await requestBackend('/auth/users', {
    method: 'POST',
    accessToken,
    body,
  });

  const response = NextResponse.json(payload, { status });
  response.headers.set('Cache-Control', 'no-store');

  return response;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null;

  if (!accessToken) {
    const response = NextResponse.json(
      buildApiEnvelope('Authentication required.'),
      { status: 401 },
    );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const timestampRange = readTimestampRangeQueryFromSearchParams(
    new URL(request.url).searchParams,
  );
  const searchParams = buildDateRangeSearchParams(
    new URLSearchParams(),
    timestampRange,
  );
  const searchQuery = searchParams.toString();
  const path = `/auth/users${searchQuery ? `?${searchQuery}` : ''}`;

  const { status, payload } = await requestBackend(path, {
    method: 'GET',
    accessToken,
  });

  const response = NextResponse.json(payload, { status });
  response.headers.set('Cache-Control', 'no-store');

  return response;
}
