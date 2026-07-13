import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { requestBackend } from '@/lib/api/backend-api';
import { buildNoStoreJsonResponse } from '@/lib/api/server-proxy';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const normalizedToken = token.trim();

  if (!isValidSigningToken(normalizedToken)) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Invoice signing link is invalid.'),
      400,
    );
  }

  const { status, payload } = await requestBackend(
    `/invoice-signing/${normalizedToken}`,
  );

  return buildNoStoreJsonResponse(payload, status || 500);
}

function isValidSigningToken(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}
