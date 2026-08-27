import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';
import { createShipmentAdditionalCostSchema } from '@/features/costs/schemas/cost.schema';
import { isValidShipmentId } from '@/features/shipments/lib/shipments.helpers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shipmentId: string }> },
) {
  const { shipmentId } = await params;
  const normalizedShipmentId = shipmentId.trim();

  if (!isValidShipmentId(normalizedShipmentId)) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Shipment identifier is invalid.'),
      400,
    );
  }

  const requestBody = await request.json().catch(() => null);
  const parsedPayload =
    createShipmentAdditionalCostSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ??
          'Invalid additional cost payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession(
    `/costs/shipment/${normalizedShipmentId}/additional`,
    {
      method: 'POST',
      body: parsedPayload.data,
    },
  );
}
