import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') ?? '30';
  const unreadOnly = url.searchParams.get('unreadOnly');
  const query = new URLSearchParams({ limit });
  const category = url.searchParams.get('category');
  if (category) query.set('category', category);

  if (unreadOnly) {
    query.set('unreadOnly', unreadOnly);
  }

  return proxyBackendWithSession(`/notifications?${query.toString()}`);
}

