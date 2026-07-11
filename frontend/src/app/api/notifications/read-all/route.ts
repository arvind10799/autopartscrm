import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function PATCH() {
  return proxyBackendWithSession('/notifications/read-all', {
    method: 'PATCH',
  });
}

