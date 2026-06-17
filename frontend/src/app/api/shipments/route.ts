import { buildShipmentsQueryString, parseShipmentsQueryParams } from '@/features/shipments/lib/shipments.helpers';
import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const normalizedQuery = parseShipmentsQueryParams(
    new URL(request.url).searchParams,
  );
  const path = `/shipments?${buildShipmentsQueryString(normalizedQuery)}`;

  return proxyBackendWithSession(path);
}

export async function POST(request: Request) {
  const body = await request.json();

  return proxyBackendWithSession('/shipments', {
    method: 'POST',
    body,
  });
}
