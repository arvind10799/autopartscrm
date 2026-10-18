import { proxyBackendWithSession } from '@/lib/api/server-proxy';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyBackendWithSession(
    `/website-leads/${encodeURIComponent(id)}/convert`,
    { method: 'POST', body: await request.json().catch(() => ({})) },
  );
}
