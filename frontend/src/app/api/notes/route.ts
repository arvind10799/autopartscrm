import { buildApiEnvelope } from '@/lib/api/api-envelope';
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from '@/lib/api/server-proxy';
import { createNoteSchema } from '@/features/notes/schemas/note.schema';
import { toBackendCreateNotePayload } from '@/features/notes/lib/notes.helpers';

export async function POST(request: Request) {
  const requestBody = await request.json().catch(() => null);
  const parsedPayload = createNoteSchema.safeParse(requestBody);

  if (!parsedPayload.success) {
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        parsedPayload.error.issues[0]?.message ?? 'Invalid note payload.',
      ),
      400,
    );
  }

  return proxyBackendWithSession('/notes', {
    method: 'POST',
    body: toBackendCreateNotePayload(parsedPayload.data),
  });
}
