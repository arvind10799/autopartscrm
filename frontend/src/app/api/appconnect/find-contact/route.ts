import { requestBackend } from '@/lib/api/backend-api';
import { buildNoStoreJsonResponse } from '@/lib/api/server-proxy';

type AppConnectMatchedContact = {
  id: string;
  name: string;
  phone: string;
  type: 'order' | 'lead';
  additionalInfo: Record<string, string>;
};

type AppConnectFindContactResponse = {
  successful: boolean;
  matchedContactInfo: AppConnectMatchedContact[];
};

const emptyResponse: AppConnectFindContactResponse = {
  successful: true,
  matchedContactInfo: [],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone') ?? '';
  const token = extractBearerToken(request.headers.get('authorization'));

  if (!token) {
    return buildNoStoreJsonResponse(
      {
        successful: false,
        matchedContactInfo: [],
      },
      401,
    );
  }

  const backendPath = `/appconnect/find-contact?phone=${encodeURIComponent(
    phone,
  )}`;
  const { status, payload } = await requestBackend<AppConnectFindContactResponse>(
    backendPath,
    {
      accessToken: token,
      forwardedHeaders: request.headers,
    },
  );

  if (status >= 500) {
    return buildNoStoreJsonResponse(
      {
        successful: false,
        matchedContactInfo: [],
      },
      status,
    );
  }

  if (!payload.success || !payload.data) {
    return buildNoStoreJsonResponse(emptyResponse, status || 200);
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
