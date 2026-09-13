import { NextResponse } from 'next/server';
import { getBackendApiUrl, getBackendApiTimeoutMs } from '@/lib/config/env.server';

export async function POST(request: Request) {
  const validationToken = request.headers.get('validation-token');
  const contentType = request.headers.get('content-type') ?? '';
  const rawBody = await request.text();
  const response = await fetch(`${getBackendApiUrl()}/ringcentral/call-webhook`, {
    method: 'POST',
    headers: {
      ...(validationToken ? { 'Validation-Token': validationToken } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body: rawBody || undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(getBackendApiTimeoutMs()),
  });
  const responseText = await response.text().catch(() => '');
  const proxyResponse = new NextResponse(responseText || null, {
    status: response.status,
    headers: {
      'Cache-Control': 'no-store',
      ...(response.headers.get('content-type')
        ? { 'Content-Type': response.headers.get('content-type') as string }
        : {}),
    },
  });
  const responseValidationToken = response.headers.get('validation-token');

  if (responseValidationToken) {
    proxyResponse.headers.set('Validation-Token', responseValidationToken);
  }

  return proxyResponse;
}
