import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function PATCH(request: Request) {
  const category = new URL(request.url).searchParams.get('category');
  const query = new URLSearchParams(category ? {category} : {});
  return proxyBackendWithSession(`/notifications/clear-all?${query}`, {
    method: 'PATCH',
  });
}

