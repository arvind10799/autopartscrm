import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { isValidOrderId } from '@/features/orders/lib/orders.helpers';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

export async function POST(
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

  return proxyBackendWithSession(`/orders/${normalizedId}/invoice/signing-link`, {
    method: 'POST',
  });
}
