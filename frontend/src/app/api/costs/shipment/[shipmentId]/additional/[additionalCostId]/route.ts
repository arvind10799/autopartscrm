import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';
import { updateShipmentAdditionalCostSchema } from '@/features/costs/schemas/cost.schema';
import { isValidShipmentId } from '@/features/shipments/lib/shipments.helpers';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shipmentId: string; additionalCostId: string }> },
) {
  const { shipmentId, additionalCostId } = await params;
  const normalizedShipmentId = shipmentId.trim();
  const normalizedAdditionalCostId = additionalCostId.trim();

  if (!isValidShipmentId(normalizedShipmentId)) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Shipment identifier is invalid.'),
      400,
    );
  }

  if (!isValidShipmentId(normalizedAdditionalCostId)) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Additional cost identifier is invalid.'),
      400,
    );
  }

  const requestBody = await request.json().catch(() => null);
  const parsedPayload =
    updateShipmentAdditionalCostSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ??
          'Invalid additional cost update payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession(
    `/costs/shipment/${normalizedShipmentId}/additional/${normalizedAdditionalCostId}`,
    {
      method: 'PATCH',
      body: parsedPayload.data,
    },
  );
}
