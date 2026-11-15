import { reminderPolicySchema } from "@/features/reminders/reminder-policy.schema";
import { proxyReminderExport } from "@/lib/api/reminder-export-proxy";
import { z } from "zod";
import {
  contexts,
  displayZones,
  reminderActionSchema,
  createReminderSchema,
} from "@/features/reminders/reminder.schema";
import { buildApiEnvelope } from "@/lib/api/api-envelope";
import {
  buildNoStoreJsonResponse,
  proxyBackendWithSession,
} from "@/lib/api/server-proxy";
type RouteContext = { params: Promise<{ segments: string[] }> };
const id = z.string().uuid();
export async function GET(request: Request, { params }: RouteContext) {
  const { segments } = await params;
  const exportPath = segments.join("/");
  if (["calendar-export.ics", "reports/export.xlsx"].includes(exportPath)) {
    const search = new URL(request.url).searchParams;
    const allowed = [
      "kind",
      "scope",
      "tab",
      "search",
      "ownerId",
      "context",
      "typeKey",
      "priority",
      "status",
      "from",
      "to",
      "displayTimeZone",
      "working",
      "flagged",
      "handoff",
      "calendar",
      "page",
      "limit",
    ];
    if ([...search.keys()].some((k) => !allowed.includes(k)))
      return buildNoStoreJsonResponse(
        buildApiEnvelope("Invalid export filter."),
        400,
      );
    return proxyReminderExport(exportPath, search);
  }
  if (
    [
      "policy",
      "preferences/me",
      "notifications/configuration",
      "notifications/settings",
      "automation/settings",
    ].includes(segments.join("/")) ||
    (segments.length === 3 &&
      segments[0] === "preferences" &&
      segments[1] === "users" &&
      id.safeParse(segments[2]).success) ||
    (segments.length === 3 &&
      segments[0] === "notifications" &&
      segments[1] === "alerts" &&
      id.safeParse(segments[2]).success)
  )
    return proxyBackendWithSession(`/reminders/${segments.join("/")}`);
  if (
    segments.length === 1 &&
    ["summary", "workspace", "records", "follow-ups", "reports"].includes(
      segments[0],
    )
  ) {
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();
    const allowed = [
      "kind",
      "scope",
      "tab",
      "search",
      "ownerId",
      "context",
      "typeKey",
      "priority",
      "status",
      "from",
      "to",
      "displayTimeZone",
      "working",
      "flagged",
      "handoff",
      "calendar",
      "page",
      "limit",
    ];
    for (const [key, value] of source) {
      if (!allowed.includes(key))
        return buildNoStoreJsonResponse(
          buildApiEnvelope("Invalid task filter."),
          400,
        );
      query.set(key, value);
    }
    return proxyBackendWithSession(`/reminders/${segments[0]}?${query}`);
  }
  if (segments.length === 1 && segments[0] === "record") {
    const search = new URL(request.url).searchParams;
    const context = z.enum(contexts).safeParse(search.get("context"));
    const record = id.safeParse(search.get("recordId"));
    if (!context.success || (context.data !== "PERSONAL" && !record.success))
      return buildNoStoreJsonResponse(
        buildApiEnvelope("Invalid reminder record."),
        400,
      );
    const query = new URLSearchParams({
      context: context.data,
      page: search.get("page") ?? "1",
      history: search.get("history") ?? "false",
    });
    if (record.success) query.set("recordId", record.data);
    return proxyBackendWithSession(`/reminders/record?${query}`);
  }
  if (
    segments.length === 2 &&
    segments[1] === "history" &&
    id.safeParse(segments[0]).success
  )
    return proxyBackendWithSession(`/reminders/${segments[0]}/history`);
  return buildNoStoreJsonResponse(buildApiEnvelope("Not found."), 404);
}
export async function PATCH(request: Request, { params }: RouteContext) {
  const { segments } = await params;
  const input = await request.json().catch(() => null);
  if (segments.join("/") === "policy") {
    const parsed = reminderPolicySchema.strict().safeParse(input);
    if (!parsed.success)
      return buildNoStoreJsonResponse(
        buildApiEnvelope("Invalid scheduling settings."),
        400,
      );
    return proxyBackendWithSession("/reminders/policy", {
      method: "PATCH",
      body: parsed.data,
    });
  }
  if (
    segments.length === 3 &&
    segments[0] === "automation" &&
    ["rules", "types"].includes(segments[1]) &&
    /^[A-Z][A-Z0-9_]{0,79}$/.test(segments[2])
  ) {
    const schema =
      segments[1] === "rules"
        ? z
            .object({
              version: z.number().int().positive(),
              isActive: z.boolean().optional(),
              delayDays: z.number().int().min(0).max(365).optional(),
              delayMinutes: z.number().int().min(0).max(525600).optional(),
              repeatDays: z
                .number()
                .int()
                .min(1)
                .max(365)
                .nullable()
                .optional(),
            })
            .strict()
        : z
            .object({
              label: z.string().trim().min(1).max(80).optional(),
              isActive: z.boolean().optional(),
              allowedRoles: z
                .array(z.enum(["ADMIN", "SALES", "SHIPPING"]))
                .min(1)
                .max(3)
                .optional(),
            })
            .strict();
    const payload = schema.safeParse(input);
    if (!payload.success)
      return buildNoStoreJsonResponse(
        buildApiEnvelope("Invalid automation settings."),
        400,
      );
    return proxyBackendWithSession(`/reminders/${segments.join("/")}`, {
      method: "PATCH",
      body: payload.data,
    });
  }
  if (segments.join("/") === "notifications/settings") {
    const payload = z
      .object({
        deliveryEnabled: z.boolean().optional(),
        secondAlertMinutes: z
          .number()
          .int()
          .min(15)
          .max(240)
          .nullable()
          .optional(),
        escalationMinutes: z
          .number()
          .int()
          .min(30)
          .max(1440)
          .nullable()
          .optional(),
        workingMarkerMinutes: z.number().int().min(30).max(480).optional(),
        snoozeFlagCount: z.number().int().min(1).max(10).nullable().optional(),
      })
      .strict()
      .safeParse(input);
    if (!payload.success)
      return buildNoStoreJsonResponse(
        buildApiEnvelope("Invalid reminder settings."),
        400,
      );
    return proxyBackendWithSession("/reminders/notifications/settings", {
      method: "PATCH",
      body: payload.data,
    });
  }
  if (
    segments.length === 2 &&
    id.safeParse(segments[0]).success &&
    segments[1] === "reschedule"
  ) {
    const payload = z
      .object({
        version: z.number().int().positive(),
        dueAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .safeParse(input);
    if (!payload.success)
      return buildNoStoreJsonResponse(
        buildApiEnvelope("Invalid reschedule time."),
        400,
      );
    return proxyBackendWithSession(`/reminders/${segments[0]}/reschedule`, {
      method: "PATCH",
      body: payload.data,
    });
  }
  if (
    segments.join("/") === "preferences/me" ||
    (segments.length === 3 &&
      segments[0] === "preferences" &&
      segments[1] === "users" &&
      id.safeParse(segments[2]).success)
  ) {
    const payload = z
      .object({
        displayTimeZone: z.enum(displayZones).optional(),
        workingStartMinute: z.number().int().min(0).max(1439).optional(),
        workingEndMinute: z.number().int().min(0).max(1439).optional(),
        dailyDigestEnabled: z.boolean().optional(),
      })
      .strict()
      .safeParse(input);
    if (!payload.success)
      return buildNoStoreJsonResponse(
        buildApiEnvelope("Invalid display time zone."),
        400,
      );
    return proxyBackendWithSession(`/reminders/${segments.join("/")}`, {
      method: "PATCH",
      body: payload.data,
    });
  }
  if (segments.length !== 1 || !id.safeParse(segments[0]).success)
    return buildNoStoreJsonResponse(buildApiEnvelope("Not found."), 404);
  const payload = reminderActionSchema.safeParse(input);
  if (!payload.success)
    return buildNoStoreJsonResponse(
      buildApiEnvelope(
        payload.error.issues[0]?.message ?? "Invalid reminder action.",
      ),
      400,
    );
  return proxyBackendWithSession(`/reminders/${segments[0]}`, {
    method: "PATCH",
    body: payload.data,
  });
}
export async function POST(request: Request, { params }: RouteContext) {
  const { segments } = await params;
  if (segments[0] === "automation") {
    let schema: z.ZodTypeAny;
    if (
      segments.length === 4 &&
      segments[1] === "suggestions" &&
      id.safeParse(segments[2]).success &&
      ["accept", "dismiss"].includes(segments[3])
    )
      schema =
        segments[3] === "accept"
          ? createReminderSchema
              .extend({
                version: z.number().int().positive(),
                ruleVersion: z.number().int().positive(),
              })
              .strict()
          : z.object({ version: z.number().int().positive() }).strict();
    else if (segments.length === 2 && segments[1] === "types")
      schema = z
        .object({
          key: z
            .string()
            .regex(/^USER_[A-Z0-9_]+$/)
            .max(50),
          label: z.string().trim().min(1).max(80),
          allowedRoles: z
            .array(z.enum(["ADMIN", "SALES", "SHIPPING"]))
            .min(1)
            .max(3),
        })
        .strict();
    else return buildNoStoreJsonResponse(buildApiEnvelope("Not found."), 404);
    const payload = schema.safeParse(await request.json().catch(() => null));
    if (!payload.success)
      return buildNoStoreJsonResponse(
        buildApiEnvelope("Invalid automation request."),
        400,
      );
    return proxyBackendWithSession(`/reminders/${segments.join("/")}`, {
      method: "POST",
      body: payload.data,
    });
  }
  if (segments[0] === "notifications") {
    const input = await request.json().catch(() => null);
    let schema: z.ZodTypeAny;
    if (segments.length === 2 && segments[1] === "subscribe")
      schema = z
        .object({
          endpoint: z.string().url().max(2048),
          expirationTime: z.number().nullable().optional(),
          keys: z
            .object({
              p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
              auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
            })
            .strict(),
        })
        .strict();
    else if (segments.length === 2 && segments[1] === "unsubscribe")
      schema = z.object({ endpoint: z.string().max(2048) }).strict();
    else if (
      segments.length === 3 &&
      segments[1] === "alerts" &&
      id.safeParse(segments[2]).success
    )
      schema = z
        .object({
          action: z.enum(["COMPLETE", "SNOOZE", "WORK"]),
          version: z.number().int().positive(),
          snoozeMinutes: z.union([z.literal(15), z.literal(60)]).optional(),
          completionNote: z.string().max(1000).optional(),
        })
        .strict();
    else return buildNoStoreJsonResponse(buildApiEnvelope("Not found."), 404);
    const payload = schema.safeParse(input);
    if (!payload.success)
      return buildNoStoreJsonResponse(
        buildApiEnvelope("Invalid reminder request."),
        400,
      );
    if (segments[1] === "subscribe") delete payload.data.expirationTime;
    return proxyBackendWithSession(`/reminders/${segments.join("/")}`, {
      method: "POST",
      body: payload.data,
    });
  }
  if (segments.join("/") !== "inbox/seen")
    return buildNoStoreJsonResponse(buildApiEnvelope("Not found."), 404);
  const payload = z
    .object({ seenThrough: z.string().datetime({ offset: true }) })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!payload.success)
    return buildNoStoreJsonResponse(
      buildApiEnvelope("Invalid acknowledgement."),
      400,
    );
  return proxyBackendWithSession("/reminders/inbox/seen", {
    method: "POST",
    body: payload.data,
  });
}
