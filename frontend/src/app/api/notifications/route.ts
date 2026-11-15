import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') ?? '30';
  const unreadOnly = url.searchParams.get('unreadOnly');
  const query = new URLSearchParams({ limit });
  if(url.searchParams.get('category')==='REMINDERS')query.set('category','REMINDERS');

  if (unreadOnly) {
    query.set('unreadOnly', unreadOnly);
  }

  return proxyBackendWithSession(`/notifications?${query.toString()}`);
}

