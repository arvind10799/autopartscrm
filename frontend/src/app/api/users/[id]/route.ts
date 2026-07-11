import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAMES } from '@/features/auth/lib/auth-session';
import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { requestBackend } from '@/lib/api/backend-api';

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null;
}

function unauthenticatedResponse() {
  const response = NextResponse.json(
    buildApiEnvelope('Authentication required.'),
    { status: 401 },
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return unauthenticatedResponse();
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(buildApiEnvelope('Invalid request body.'), {
      status: 400,
    });
  }

  const { id } = await context.params;
  const { status, payload } = await requestBackend(
    `/auth/users/${encodeURIComponent(id)}`,
    { method: 'PATCH', accessToken, body },
  );
  const response = NextResponse.json(payload, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return unauthenticatedResponse();
  }

  const { id } = await context.params;
  const { status, payload } = await requestBackend(
    `/auth/users/${encodeURIComponent(id)}`,
    { method: 'DELETE', accessToken },
  );
  const response = NextResponse.json(payload, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
