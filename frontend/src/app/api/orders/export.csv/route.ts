import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/features/auth/lib/auth-session';
import {
  buildOrdersQueryString,
  parseOrdersQueryParams,
} from '@/features/orders/lib/orders.helpers';
import { buildUnauthorizedApiResponse } from '@/lib/api/server-proxy';
import { getBackendApiTimeoutMs, getBackendApiUrl } from '@/lib/config/env.server';

export async function GET(request: Request) {
  const session = readSessionFromCookies(await cookies());

  if (!session.accessToken) {
    return buildUnauthorizedApiResponse();
  }

  const normalizedQuery = parseOrdersQueryParams(new URL(request.url).searchParams);
  const queryString = buildOrdersQueryString(normalizedQuery);
  const backendResponse = await fetch(
    `${getBackendApiUrl()}/orders/export.csv?${queryString}`,
    {
      headers: {
        Accept: 'text/csv',
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(getBackendApiTimeoutMs()),
    },
  );
  const responseBody = await backendResponse.text();
  const response = new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type':
        backendResponse.headers.get('content-type') ?? 'text/csv; charset=utf-8',
    },
  });
  const contentDisposition = backendResponse.headers.get('content-disposition');

  if (contentDisposition) {
    response.headers.set('Content-Disposition', contentDisposition);
  }

  return response;
}
