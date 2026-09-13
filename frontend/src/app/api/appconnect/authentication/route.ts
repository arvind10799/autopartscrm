import { requestBackend } from '@/lib/api/backend-api';
import { buildNoStoreJsonResponse } from '@/lib/api/server-proxy';

type AppConnectAuthenticationResponse = {
  user: {
    username: string;
  };
  message: string;
};

export async function GET(request: Request) {
  const token = extractBearerToken(request.headers.get('authorization'));

  if (!token) {
    return buildNoStoreJsonResponse(
      {
        user: null,
        message: 'Missing App Connect bearer token.',
      },
      401,
    );
  }

  const { status, payload } =
    await requestBackend<AppConnectAuthenticationResponse>(
      '/appconnect/authentication',
      {
        accessToken: token,
        forwardedHeaders: request.headers,
      },
    );

  if (!payload.success || !payload.data) {
    return buildNoStoreJsonResponse(
      {
        user: null,
        message: payload.message || 'Invalid App Connect bearer token.',
      },
      status || 401,
    );
  }

  return buildNoStoreJsonResponse(payload.data, status || 200);
}

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    return null;
  }

  return token.trim();
}
