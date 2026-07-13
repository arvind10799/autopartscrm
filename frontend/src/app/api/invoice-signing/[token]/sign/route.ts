import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { requestBackend } from '@/lib/api/backend-api';
import { signInvoiceSchema } from '@/features/invoices/schemas/invoice.schema';
import { buildNoStoreJsonResponse } from '@/lib/api/server-proxy';

export async function POST(
  request: Request,
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

  const requestBody = await request.json().catch(() => null);
  const parsedPayload = signInvoiceSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid signature payload.',
      ),
      400,
    );
  }

  const { status, payload } = await requestBackend(
    `/invoice-signing/${normalizedToken}/sign`,
    {
      method: 'POST',
      body: parsedPayload.data,
    },
  );

  return buildNoStoreJsonResponse(payload, status || 500);
}

function isValidSigningToken(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}
