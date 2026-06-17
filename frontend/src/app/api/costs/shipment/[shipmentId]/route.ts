import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';
import { isValidShipmentId } from '@/features/shipments/lib/shipments.helpers';
import { updateShipmentCostSchema } from '@/features/costs/schemas/cost.schema';
import { toBackendUpdateShipmentCostPayload } from '@/features/costs/lib/costs.helpers';

export async function GET(
  _request: Request,
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

  return proxyBackendWithSession(`/costs/shipment/${normalizedShipmentId}`);
}

export async function PATCH(
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
  const parsedPayload = updateShipmentCostSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ??
          'Invalid shipment cost update payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession(`/costs/shipment/${normalizedShipmentId}`, {
    method: 'PATCH',
    body: toBackendUpdateShipmentCostPayload(parsedPayload.data),
  });
}
