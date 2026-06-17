import { NextResponse } from 'next/server';
import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { requestBackend } from '@/lib/api/backend-api';
import {
  applyAuthCookies,
  toClientSession,
} from '@/features/auth/lib/auth-session';
import { loginSchema } from '@/features/auth/schemas/login.schema';
import { authBackendSessionSchema } from '@/features/auth/schemas/session.schema';
import type {
  AuthBackendSession,
  ClientSession,
  LoginPayload,
} from '@/features/auth/types/auth.types';

export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => null);
  const parsedPayload = loginSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    const response = NextResponse.json(
      buildApiEnvelope<LoginPayload>(
        parsedPayload.error.issues[0]?.message ?? 'Invalid login payload.',
      ),
      { status: 400 },
    );

    response.headers.set('Cache-Control', 'no-store');

    return response;
  }

  const { status, payload } = await requestBackend<AuthBackendSession>('/auth/login', {
    method: 'POST',
    body: parsedPayload.data,
  });

  if (status >= 400 || !payload?.data) {
    const response = NextResponse.json(
      buildApiEnvelope<ClientSession>(payload?.message ?? 'Login failed.'),
      { status: status || 500 },
    );

    response.headers.set('Cache-Control', 'no-store');

    return response;
  }

  const parsedBackendSession = authBackendSessionSchema.safeParse(payload.data);

  if (!parsedBackendSession.success) {
    const response = NextResponse.json(
      buildApiEnvelope<ClientSession>('Login response payload was invalid.'),
      { status: 502 },
    );

    response.headers.set('Cache-Control', 'no-store');

    return response;
  }

  const backendSession: AuthBackendSession = parsedBackendSession.data;
  const clientSession: ClientSession = toClientSession(backendSession.user);

  const response = NextResponse.json({
    success: true,
    data: clientSession,
    message: payload.message ?? 'Login successful.',
  });

  applyAuthCookies(response, backendSession);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}
