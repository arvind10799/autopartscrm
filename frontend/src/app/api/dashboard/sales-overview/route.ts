import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const path = query ? `/dashboard/sales-overview?${query}` : '/dashboard/sales-overview';

  return proxyBackendWithSession(path);
}
