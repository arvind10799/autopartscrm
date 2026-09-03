import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { updateReplacementSchema } from '@/features/replacements/schemas/replacement.schema';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return proxyBackendWithSession(`/replacements/${id}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestBody = await request.json().catch(() => null);
  const parsedPayload = updateReplacementSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid replacement payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession(`/replacements/${id}`, {
    method: 'PATCH',
    body: parsedPayload.data,
  });
}
