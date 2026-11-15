# Reminders Phase 5 — Suggestions, repetition and Admin controls

Implemented locally on November 15, 2026. AWS and production data have not been accessed or changed. This phase builds on the four pending reminder migrations; it does not replace them. Deployment and delivery activation remain separate approved steps.

## What users see

- Record reminder panels show **Suggested next steps** after a relevant business event. Each suggestion can be accepted, adjusted or dismissed. No task is created until someone accepts it.
- A callback suggestion requires the user to choose the agreed time. Suggestions show the customer's time zone. A similar open task is flagged before adding another; the final save also checks duplicates and requires explicit **Save anyway** acknowledgement.
- Accepted/dismissed decisions survive refresh, sign-out and restart. Ordinary edits do not republish a dismissed suggestion. A new status transition can offer a new suggestion.
- The forms support **Does not repeat**, **Daily**, **Every N days** (1–365), and **Weekly** with a selected weekday. Optional end date, occurrence count (1–1,000) and record-status conditions are available. The earliest applicable ending condition wins.
- Repeating tasks display their frequency and occurrence number. Edit offers **This occurrence only** or **This and future occurrences**. Stop repeating cancels the current occurrence and ends the series. Removing repetition through future edits keeps the current task open but creates no further occurrences.
- Record panels refresh when the loaded record changes, including inline status, assignment, invoice and cost updates. Existing focus/visibility refresh and the bounded one-minute refresh remain.
- Admin → User Center → Reminders contains the new types and suggestion-rule controls. Delivery settings remain separate and default off.

## Repeat scheduling behavior

There is at most one open/snoozed occurrence for each series. Completion, optional outcome note, history, series count and creation of the next occurrence share a serializable transaction. Version checks and unique database indexes protect against double-clicks, retries and simultaneous Shipping completion.

Only manual completion advances a series. The next occurrence uses the next future scheduled customer-local date and clock. Late completion skips missed dates rather than creating a backlog. The occurrence limit counts completed occurrences, including the first task; skipped dates do not consume the limit. Snoozing changes only the current occurrence, not the series anchor, template or completed count.

Current-only edits do not change the future template. Future edits update the template and optional schedule. A changed due time in future scope becomes the new base for future dates. Manual creation still rejects unavailable/ambiguous daylight-saving times unless an explicit valid offset is selected. Generated occurrences shift a spring gap to the first valid minute and use the earlier fall-back instant; the nominal series clock is retained for later dates. Arizona remains on its fixed offset.

Stopping a series retains tasks and audit history. Disabled reminder types or types unavailable to the owner prevent generation of another occurrence; existing tasks remain available for completion/history. Rule changes do not silently alter previously accepted repeating schedules.

## Record lifecycle and ownership

- A repeating website inquiry task follows reassignment and can continue on the converted lead. An explicit **Converted** stop condition ends it instead. Customer state changes update its zone while retaining its local clock, subject to the existing DST validation.
- Lead-to-order conversion stops repeating lead tasks. Existing one-time task transfer remains controlled by the existing conversion checkbox.
- Manual lead ownership remains the lead's adviser/creator. Website lead tasks follow the current assigned agent; Shipping tasks use the existing shared Shipping queue. Explicit handoffs target the existing record agent, not an arbitrary caller-supplied assignee.
- Signing an invoice completes signature follow-ups automatically and stops any associated series without generating another occurrence. Resending an outstanding request does not offer the same signature suggestion again. Reset/clone followed by a new signing request starts a new suggestion cycle.
- Order cancellation/refund, tracking delivery, replacement delivery and explicit repeat stop conditions cancel/complete the relevant current task and stop its series in the record transaction. Lost/not-interested lead statuses retain the existing optional cancellation flow.
- Completion notes use the existing note flow once. Creating or snoozing a reminder does not update lead activity or send ordinary lead-note notifications.

## Default suggestions

31 built-in rules are seeded once into the new rule table. They use stable internal keys.

| Workspace / event | Suggested next step |
| --- | --- |
| Website inquiry newly assigned / Contacted | Call in 1 hour / follow up in 1 day |
| Lead Prospect / Quoted / Call back later / Shopping around | Call in 1 day / quote follow-up in 2 days / choose callback time / quote follow-up in 3 days |
| Order Draft / Partially paid / signature request | Follow up in 1 day / payment follow-up in 1 day / signature follow-up in 24 hours |
| Confirmed shipment order without a shipment | Locate a yard in 1 hour |
| Shipment Pending / Locating | Yard follow-up in 1 hour |
| Shipment Pre-processing / Purchase | Purchase check in 1 day; cost entry in 1 hour only if actual purchase cost is missing |
| Shipment Shipped / In transit | Tracking in 2 days, repeating every 2 days until Delivered |
| Shipment Disputed / Delayed | Daily carrier follow-up until Delivered; separate Sales handoff in 1 hour |
| Shipment Delivered | Customer delivery check-in by the Sales agent in 1 day |
| Replacement Waiting yard response / Yard contacted | Yard follow-up in 1 day |
| Replacement Agreed | Pickup scheduling in 1 hour |
| Replacement Disagreed / Yard refunding / No replacement | Sales handoff in 1 hour |
| Replacement Shipped / In transit | Tracking every 2 days until Delivered |

Calendar-day delays retain the local clock; minute delays apply when the day delay is zero. Late acceptance offers a future slot. A DST ambiguity requires user review. Cost suggestions use the **hasActualPurchaseAmount** flag, so a legitimate actual zero is distinguished from a missing cost.

Event hooks run transactionally in the existing Prisma repositories for lead/order/shipment/replacement creation and status updates, website claim/assignment, and invoice signing state changes. Reading a page never creates suggestion rows. Existing records are not scanned or backfilled on migration; their next relevant business event can produce suggestions.

## Admin controls and access

- Add custom reminder types using `USER_` keys, rename display labels, set role availability and disable types. Built-in keys cannot be replaced through the create API. Admin access is retained for each type.
- Enable/disable each built-in suggestion rule, adjust its calendar-day/minute delay, and set/remove a repeat interval. Callback suggestions retain explicit time selection. Record context, target and safety stop conditions are fixed by the rule.
- Type/rule changes are audited. Rule edits use version checks; accepting a stale or disabled suggestion fails without creating a task or consuming the suggestion.
- Authenticated API/controller role guards and service-level record ownership checks apply. Controllers remain thin. The Next proxy accepts only whitelisted paths and validated payloads.
- New paths are under `/reminders/automation`: `GET settings`, `POST types`, `PATCH types/:key`, `PATCH rules/:key`, `POST suggestions/:id/accept`, and `POST suggestions/:id/dismiss`.
- Series responses expose safe scheduling metadata, not their private template notes. Existing Shipping status-only redaction and task ownership restrictions remain in place.

## Additive migration and deployment boundary

`20261115090000_add_reminder_automation` adds ReminderSeries, ReminderSuggestionRule, ReminderSuggestion and ReminderAutomationAudit, enums, nullable series/ordinal links on Reminder, foreign keys and indexes. The only seed inserts target the new rule table. It does not update/delete original customer, lead, order, shipment, invoice, note or notification values, or convert existing one-time reminders into series.

The SQL transaction uses bounded lock/statement timeouts. A partial unique index allows only one open/snoozed occurrence per series; another unique constraint protects occurrence ordinals. A check requires series and occurrence number to appear together. Reminder and audit foreign keys protect history.

Deployment must include all five pending migrations and the matching API/frontend/worker, using the backup/recovery and approval steps documented in Phase 1. Do not reset the production database, force-push the schema, run general seed scripts, or roll back by dropping reminder tables. External delivery remains gated by the Phase 4 environment and database switches. Phase 5 adds no customer SMS or email traffic.

## Local verification

- Backend build, frontend TypeScript check and production build pass.
- All 100 targeted reminder and website-lead tests pass. The earlier full backend suite has 124 passing tests and the four previously established Order/Shipment baseline failures (before the final four pure suggestion-timing cases were added).
- Real disposable PostgreSQL checks cover all five phases, all 16 original-table snapshots, complete/repeated Prisma migration deployment on a second database, simultaneous repeat completion, note exactly once, current/future edits, snooze independence, date/count stops, conversion/reassignment/time-zone changes, actual-cost suggestions, delivery/signing closure, durable dismissal/acceptance, duplicate warnings, rollback, stale rules and Admin RBAC/audits.
- Pure scheduling tests cover large late-completion skips, N-day anchors, weekly weekdays, end-date boundaries, DST gaps/repeated hours, Arizona, invalid repeat options and suggestion timing.
- Local browser review covers repeat edit scope, occurrence completion/next occurrence, quote suggestion adjustment/acceptance, callback-time selection and Admin rule saving. After the final frontend build, an inline status change showed its new suggestion in 393 ms; dismissal survived reload. No manual panel refresh was needed.
- The retained review harness resumes existing synthetic data rather than reseeding. `--phase5` adds only labeled synthetic preview records/tasks when absent. Push/SMTP/SMS and background delivery are disabled; no real provider/device delivery is claimed.

## Next

Phase 6 remains: the remaining follow-up table columns/filters/exports, advanced reports/calendar export and final release verification/polish. This document is not production deployment approval.
