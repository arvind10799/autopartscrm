import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { isValidShipmentId } from '@/features/shipments/lib/shipments.helpers';
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

  if (!isValidShipmentId(normalizedId)) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Shipment identifier is invalid.'),
      400,
    );
  }

  return proxyBackendWithSession(`/shipments/${normalizedId}`);
}
