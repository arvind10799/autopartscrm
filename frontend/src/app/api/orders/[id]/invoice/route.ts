import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { createInvoiceSchema } from '@/features/invoices/schemas/invoice.schema';
import { isValidOrderId } from '@/features/orders/lib/orders.helpers';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const normalizedId = id.trim();

  if (!isValidOrderId(normalizedId)) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Order identifier is invalid.'),
      400,
    );
  }

  return proxyBackendWithSession(`/orders/${normalizedId}/invoice`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const normalizedId = id.trim();

  if (!isValidOrderId(normalizedId)) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Order identifier is invalid.'),
      400,
    );
  }

  const requestBody = await request.json().catch(() => null);
  const parsedPayload = createInvoiceSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid invoice payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession(`/orders/${normalizedId}/invoice`, {
    method: 'POST',
    body: parsedPayload.data,
  });
}
