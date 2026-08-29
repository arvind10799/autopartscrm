import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { isValidOrderId } from '@/features/orders/lib/orders.helpers';
import { refundOrderSchema } from '@/features/orders/schemas/order.schema';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

export async function PATCH(
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
  const parsedPayload = refundOrderSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid refund payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession(`/orders/${normalizedId}/refund`, {
    method: 'PATCH',
    body: parsedPayload.data,
  });
}
