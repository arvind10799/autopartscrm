import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const make = searchParams.get('make')?.trim();

  if (!make) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope('Vehicle make is required.'),
      400,
    );
  }

  const query = new URLSearchParams({ make });
  const year = searchParams.get('year')?.trim();
  const search = searchParams.get('search')?.trim();

  if (year) {
    query.set('year', year);
  }

  if (search) {
    query.set('search', search);
  }

  return proxyBackendWithSession(`/vehicle-lookup/models?${query}`);
}

