import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  const search = searchParams.get('search')?.trim();

  if (search) {
    query.set('search', search);
  }

  return proxyBackendWithSession(
    `/vehicle-lookup/parts${query.size > 0 ? `?${query}` : ''}`,
  );
}
