import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function PATCH(request: Request) {
  const category = new URL(request.url).searchParams.get('category');
  const query = new URLSearchParams(category ? {category} : {});
  return proxyBackendWithSession(`/notifications/read-all?${query}`, {
    method: 'PATCH',
  });
}

