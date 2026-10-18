import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyBackendWithSession(`/website-leads${url.search}`, {
    sourceRequest: request,
  });
}
