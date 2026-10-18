import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyBackendWithSession(
    `/website-leads/${encodeURIComponent(id)}/claim`,
    { method: 'POST' },
  );
}
