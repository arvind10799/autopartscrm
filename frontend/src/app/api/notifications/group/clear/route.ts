import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  const query = new URLSearchParams();

  if (entityType) {
    query.set('entityType', entityType);
  }

  if (entityId) {
    query.set('entityId', entityId);
  }

  return proxyBackendWithSession(
    `/notifications/group/clear?${query.toString()}`,
    { method: 'PATCH' },
  );
}
