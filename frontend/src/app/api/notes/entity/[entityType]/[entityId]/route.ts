import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  buildDateRangeSearchParams,
  readTimestampRangeQueryFromSearchParams,
} from '@/lib/filters/date-range';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';
import { parseNoteEntityType } from '@/features/notes/lib/notes.helpers';
import { isValidOrderId } from '@/features/orders/lib/orders.helpers';
import { isValidShipmentId } from '@/features/shipments/lib/shipments.helpers';

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ entityType: string; entityId: string }>;
  },
) {
  const { entityType, entityId } = await params;
  const normalizedEntityType = parseNoteEntityType(entityType);
  const normalizedEntityId = entityId.trim();

  if (!normalizedEntityType) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Note entity type is invalid.'),
      400,
    );
  }

  if (
    (normalizedEntityType === 'ORDER' &&
      !isValidOrderId(normalizedEntityId)) ||
    (normalizedEntityType === 'SHIPMENT' &&
      !isValidShipmentId(normalizedEntityId))
  ) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Note entity identifier is invalid.'),
      400,
    );
  }

  const timestampRange = readTimestampRangeQueryFromSearchParams(
    new URL(request.url).searchParams,
  );
  const pathSearchParams = buildDateRangeSearchParams(
    new URLSearchParams(),
    timestampRange,
  );
  const pathSuffix = pathSearchParams.toString();

  return proxyBackendWithSession(
    `/notes/entity/${normalizedEntityType}/${normalizedEntityId}${
      pathSuffix ? `?${pathSuffix}` : ''
    }`,
  );
}
