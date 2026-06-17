import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  applyAuthCookies,
  clearAuthCookies,
  readSessionFromCookies,
  toClientSession,
} from '@/features/auth/lib/auth-session';
import { requestBackend } from '@/lib/api/backend-api';
import { authUserSchema } from '@/features/auth/schemas/session.schema';
import type { AuthBackendSession, AuthUser } from '@/features/auth/types/auth.types';

export async function GET() {
  const session = readSessionFromCookies(await cookies());

  if (!session.accessToken) {
    const response = NextResponse.json(
      buildApiEnvelope<AuthUser>('Session not found.'),
      { status: 401 },
    );

    response.headers.set('Cache-Control', 'no-store');

    return response;
  }

  const { status, payload } = await requestBackend<AuthUser>('/auth/me', {
    accessToken: session.accessToken,
  });
  if (status >= 400 || !payload?.data) {
    const response = NextResponse.json(
      buildApiEnvelope<AuthUser>(payload?.message ?? 'Session expired.'),
      { status: status || 401 },
    );

    clearAuthCookies(response);
    response.headers.set('Cache-Control', 'no-store');

    return response;
  }

  const parsedUser = authUserSchema.safeParse(payload.data);

  if (!parsedUser.success) {
    const response = NextResponse.json(
      buildApiEnvelope<AuthUser>('Session response payload was invalid.'),
      { status: 502 },
    );

    clearAuthCookies(response);
    response.headers.set('Cache-Control', 'no-store');

    return response;
  }

  const normalizedSession: AuthBackendSession = {
    accessToken: session.accessToken,
    tokenType: 'Bearer',
    user: parsedUser.data,
  };
  const clientSession = toClientSession(parsedUser.data);

  const response = NextResponse.json({
    success: true,
    data: clientSession,
    message: 'Session retrieved successfully.',
  });

  applyAuthCookies(response, normalizedSession);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}
