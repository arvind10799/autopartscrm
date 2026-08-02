import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET() {
  return proxyBackendWithSession('/vehicle-lookup/years');
}

