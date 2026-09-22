import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET() {
  return proxyBackendWithSession('/leads/agents');
}
