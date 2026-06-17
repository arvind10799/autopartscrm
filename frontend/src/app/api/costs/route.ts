import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';
import { createShipmentCostSchema } from '@/features/costs/schemas/cost.schema';
import { toBackendCreateShipmentCostPayload } from '@/features/costs/lib/costs.helpers';

export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => null);
  const parsedPayload = createShipmentCostSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid shipment cost payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession('/costs', {
    method: 'POST',
    body: toBackendCreateShipmentCostPayload(parsedPayload.data),
  });
}
