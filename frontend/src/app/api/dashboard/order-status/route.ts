import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const path = query
    ? `/dashboard/order-status?${query}`
    : '/dashboard/order-status';

  return proxyBackendWithSession(path);
}
