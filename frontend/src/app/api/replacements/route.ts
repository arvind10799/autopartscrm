import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  createReplacementSchema,
} from '@/features/replacements/schemas/replacement.schema';
import {
  buildReplacementsQueryString,
  parseReplacementsQueryParams,
} from '@/features/replacements/lib/replacements.helpers';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const normalizedQuery = parseReplacementsQueryParams(
    new URL(request.url).searchParams,
  );
  const queryString = buildReplacementsQueryString(normalizedQuery);
  const path = queryString ? `/replacements?${queryString}` : '/replacements';

  return proxyBackendWithSession(path);
}

export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => null);
  const parsedPayload = createReplacementSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid replacement payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession('/replacements', {
    method: 'POST',
    body: parsedPayload.data,
  });
}
