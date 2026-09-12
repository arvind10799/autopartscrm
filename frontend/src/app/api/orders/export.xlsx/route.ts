import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/features/auth/lib/auth-session';
import {
  buildOrdersQueryString,
  parseOrdersQueryParams,
} from '@/features/orders/lib/orders.helpers';
import { buildUnauthorizedApiResponse } from '@/lib/api/server-proxy';
import { getBackendApiTimeoutMs, getBackendApiUrl } from '@/lib/config/env.server';

const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function GET(request: Request) {
  const session = readSessionFromCookies(await cookies());

  if (!session.accessToken) {
    return buildUnauthorizedApiResponse();
  }

  const normalizedQuery = parseOrdersQueryParams(new URL(request.url).searchParams);
  const queryString = buildOrdersQueryString(normalizedQuery);
  const backendResponse = await fetch(
    `${getBackendApiUrl()}/orders/export.xlsx?${queryString}`,
    {
      headers: {
        Accept: XLSX_MIME_TYPE,
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(getBackendApiTimeoutMs()),
    },
  );
  const responseBody = await backendResponse.arrayBuffer();
  const response = new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type':
        backendResponse.headers.get('content-type') ?? XLSX_MIME_TYPE,
    },
  });
  const contentDisposition = backendResponse.headers.get('content-disposition');

  if (contentDisposition) {
    response.headers.set('Content-Disposition', contentDisposition);
  }

  return response;
}
