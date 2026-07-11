import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return proxyBackendWithSession(
    `/notifications/${encodeURIComponent(id)}/clear`,
    { method: 'PATCH' },
  );
}

