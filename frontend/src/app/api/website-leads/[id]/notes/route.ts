import { proxyBackendWithSession } from '@/lib/api/server-proxy';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return proxyBackendWithSession(
    `/website-leads/${encodeURIComponent(id)}/notes`,
    { sourceRequest: request },
  );
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return proxyBackendWithSession(
    `/website-leads/${encodeURIComponent(id)}/notes`,
    { method: 'POST', body: await request.json().catch(() => ({})) },
  );
}
