import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { isValidShipmentId } from '@/features/shipments/lib/shipments.helpers';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

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

  return proxyBackendWithSession(
    `/tracking/shipment/${normalizedShipmentId}/timeline`,
  );
}
