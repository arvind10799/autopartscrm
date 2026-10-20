import { proxyBackendWithSession } from '@/lib/api/server-proxy';

type Context = { params: Promise<{ releaseId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { releaseId } = await params;
  return proxyBackendWithSession(`/releases/${encodeURIComponent(releaseId)}/seen`, {
    sourceRequest: request,
  });
}

export async function PUT(request: Request, { params }: Context) {
  const { releaseId } = await params;
  return proxyBackendWithSession(`/releases/${encodeURIComponent(releaseId)}/seen`, {
    method: 'PUT',
    sourceRequest: request,
  });
}
