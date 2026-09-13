import { buildNoStoreJsonResponse } from '@/lib/api/server-proxy';
import { requestBackend } from '@/lib/api/backend-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone') ?? '';
  const token = searchParams.get('token') ?? '';
  const backendPath = `/ringcentral/customer-lookup?phone=${encodeURIComponent(
    phone,
  )}&token=${encodeURIComponent(token)}`;
  const { status, payload } = await requestBackend(backendPath);

  return buildNoStoreJsonResponse(payload, status || 500);
}
