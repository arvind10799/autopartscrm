import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const path = query
    ? `/dashboard/agent-leads?${query}`
    : '/dashboard/agent-leads';

  return proxyBackendWithSession(path);
}
