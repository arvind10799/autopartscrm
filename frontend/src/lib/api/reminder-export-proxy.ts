import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionFromCookies } from "@/features/auth/lib/auth-session";
import {
  getBackendApiTimeoutMs,
  getBackendApiUrl,
} from "@/lib/config/env.server";
import { buildUnauthorizedApiResponse } from "./server-proxy";
export async function proxyReminderExport(
  path: string,
  search: URLSearchParams,
) {
  const session = readSessionFromCookies(await cookies());
  if (!session.accessToken) return buildUnauthorizedApiResponse();
  const response = await fetch(
    `${getBackendApiUrl()}/reminders/${path}?${search}`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(getBackendApiTimeoutMs()),
    },
  );
  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type":
        response.headers.get("content-type") ?? "application/octet-stream",
      ...(response.ok
        ? {
            "Content-Disposition":
              response.headers.get("content-disposition") ?? "attachment",
          }
        : {}),
    },
  });
}
