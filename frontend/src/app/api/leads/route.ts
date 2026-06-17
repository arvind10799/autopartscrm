import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { createLeadSchema } from '@/features/leads/schemas/lead.schema';
import {
  buildLeadsQueryString,
  parseLeadsQueryParams,
  toBackendCreateLeadPayload,
} from '@/features/leads/lib/leads.helpers';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const normalizedQuery = parseLeadsQueryParams(new URL(request.url).searchParams);
  const path = `/leads?${buildLeadsQueryString(normalizedQuery)}`;

  return proxyBackendWithSession(path);
}

export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => null);
  const parsedPayload = createLeadSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid lead payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession('/leads', {
    method: 'POST',
    body: toBackendCreateLeadPayload(parsedPayload.data),
  });
}
