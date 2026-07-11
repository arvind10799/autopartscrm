import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAMES } from '@/features/auth/lib/auth-session';
import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { requestBackend } from '@/lib/api/backend-api';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body) {
    const response = NextResponse.json(
      buildApiEnvelope('Invalid request body.'),
      { status: 400 },
    );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const { status, payload } = await requestBackend(
    `/auth/users/${encodeURIComponent(id)}/password`,
    {
      method: 'PATCH',
      accessToken,
      body,
    },
  );

  const response = NextResponse.json(payload, { status });
  response.headers.set('Cache-Control', 'no-store');

  return response;
}
