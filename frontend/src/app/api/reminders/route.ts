import { createReminderSchema } from "@/features/reminders/reminder.schema";
import { buildApiEnvelope } from "@/lib/api/api-envelope";
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from "@/lib/api/server-proxy";
export async function POST(request: Request) {
  const payload = createReminderSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!payload.success)
    return buildNoStoreJsonResponse(
      buildApiEnvelope(payload.error.issues[0]?.message ?? "Invalid reminder."),
      400,
    );
  return proxyBackendWithSession("/reminders", {
    method: "POST",
    body: payload.data,
  });
}
