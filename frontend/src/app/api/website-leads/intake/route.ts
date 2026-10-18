import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { getBackendApiUrl } from '@/lib/config/env.server';
import { buildNoStoreJsonResponse } from '@/lib/api/server-proxy';

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
    return buildNoStoreJsonResponse(buildApiEnvelope('JSON content type is required.'), 415);
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return buildNoStoreJsonResponse(buildApiEnvelope('Submission is too large.'), 413);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) {
    return buildNoStoreJsonResponse(buildApiEnvelope('Submission is too large.'), 413);
  }

  const timestamp = request.headers.get('x-website-lead-timestamp');
  const signature = request.headers.get('x-website-lead-signature');
  if (!timestamp || !signature) {
    return buildNoStoreJsonResponse(buildApiEnvelope('Website lead signature is required.'), 401);
  }

  try {
    // Forward the exact bytes WordPress signed; JSON.stringify would invalidate the HMAC.
    const backend = await fetch(`${getBackendApiUrl()}/website-leads/intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Website-Lead-Timestamp': timestamp,
        'X-Website-Lead-Signature': signature,
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    return new Response(await backend.text(), {
      status: backend.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return buildNoStoreJsonResponse(buildApiEnvelope('CRM intake is temporarily unavailable.'), 503);
  }
}
