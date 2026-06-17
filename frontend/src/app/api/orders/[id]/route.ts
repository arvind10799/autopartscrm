import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  isValidOrderId,
  toBackendUpdateOrderPayload,
} from '@/features/orders/lib/orders.helpers';
import { updateOrderSchema } from '@/features/orders/schemas/order.schema';
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

  return proxyBackendWithSession(`/orders/${normalizedId}`);
}

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
  const parsedPayload = updateOrderSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid order payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession(`/orders/${normalizedId}`, {
    method: 'PATCH',
    body: toBackendUpdateOrderPayload(parsedPayload.data),
  });
}
