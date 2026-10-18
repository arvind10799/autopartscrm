import { proxyBackendWithSession } from '@/lib/api/server-proxy';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return proxyBackendWithSession(`/website-leads/${encodeURIComponent(id)}`, {
    sourceRequest: request,
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return proxyBackendWithSession(`/website-leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: await request.json().catch(() => ({})),
  });
}
