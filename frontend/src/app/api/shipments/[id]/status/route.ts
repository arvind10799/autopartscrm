import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { isValidShipmentId } from '@/features/shipments/lib/shipments.helpers';
import { updateShipmentStatusSchema } from '@/features/shipments/schemas/shipment.schema';
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

  if (!isValidShipmentId(normalizedId)) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Shipment identifier is invalid.'),
      400,
    );
  }

  const requestBody = await request.json().catch(() => null);
  const parsedPayload = updateShipmentStatusSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid shipment status payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession(`/shipments/${normalizedId}/status`, {
    method: 'PATCH',
    body: parsedPayload.data,
  });
}
