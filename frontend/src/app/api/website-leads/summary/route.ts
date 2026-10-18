import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  return proxyBackendWithSession('/website-leads/summary', {
    sourceRequest: request,
  });
}
