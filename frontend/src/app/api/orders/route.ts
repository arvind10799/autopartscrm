import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { createOrderSchema } from '@/features/orders/schemas/order.schema';
import {
  buildOrdersQueryString,
  parseOrdersQueryParams,
  toBackendCreateOrderPayload,
} from '@/features/orders/lib/orders.helpers';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const normalizedQuery = parseOrdersQueryParams(new URL(request.url).searchParams);
  const path = `/orders?${buildOrdersQueryString(normalizedQuery)}`;

  return proxyBackendWithSession(path);
}

export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => null);
  const parsedPayload = createOrderSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid order payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession('/orders', {
    method: 'POST',
    body: toBackendCreateOrderPayload(parsedPayload.data),
  });
}
