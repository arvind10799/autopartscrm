import { buildApiEnvelope } from '@/lib/api/api-envelope';
import { updateLeadSchema } from '@/features/leads/schemas/lead.schema';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const requestBody = await request.json().catch(() => null);
  const parsedPayload = updateLeadSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid lead payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession(`/leads/${id}`, {
    method: 'PATCH',
    body: parsedPayload.data,
  });
}
