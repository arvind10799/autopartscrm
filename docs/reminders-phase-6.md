# Reminders Phase 6 — Tables, reports, exports and release review

Implemented locally, November 2026. No production access, AWS migration, deployment or real outbound messages were performed. This phase completes the remaining local work from the approved six-phase plan.

## Table behavior

Website Leads and Leads show **Next follow-up**. Orders show **Next follow-up**; Shipment Orders and Shipments show **Next check**. The cell includes the reminder type, customer-zone due time, the user's display-zone equivalent when different, and a red overdue indicator. It opens the authenticated task dialog where appropriate. Website inquiry rows retain their existing detail navigation.

The cell represents the earliest outstanding Open/Snoozed task. A past snooze presents as Open. Completed, cancelled and soft-deleted tasks are excluded. No titles or private notes are added to table payloads. Sales sees reminder information only for its own records/tasks; other agents' records retain their existing list visibility without exposing their reminders. Shipping sees shared queue checks. Admin sees all permitted record tasks.

Data loads in bounded batches of up to 100 record IDs using Prisma relation queries, rather than one browser request per row. Existing order caching remains: base order rows use the cache, and reminder summaries are added after the cache read so task actions do not leave cached follow-up metadata stale.

Tables preserve mobile cards. Wider desktop/tablet tables can scroll rather than clipping the new column or hiding action buttons.

### No upcoming reminder

Website Leads and Leads have a URL-backed **No upcoming reminder** filter. Search, dates, agent filters and pagination remain combinable and survive detail navigation. A future Open/Snoozed task qualifies; an overdue-only record still needs a future next step.

Actionable leads are unconverted Prospect, Quoted, Call back later or Shopping around records. Website inquiries are New or Contacted. Closed/converted and inactive lead statuses are excluded. The existing Not touched behavior is unchanged; applying both filters uses their intersection. Sales reminder filtering is restricted to its own leads, matching reminder access rules.

Lead and Order Excel exports include follow-up information in an additional final column, labelled with the customer time zone. Lead export honors the new filter and exports all matching records, independent of the current table page. Existing financial columns retain their offsets and workbook builder.

Dashboard → Order Status offers **Add reminder** on pending orders aged more than 14 days, using the existing dashboard aging value. Admin or the order's own Sales agent can open a prefilled reminder form. This does not create a task automatically or change the existing aging calculation.

## Follow-up insights

Admin Dashboard → Follow-ups retains its overview and adds paginated reports and Excel export. It uses the dashboard period selector and the report display zone, not the Pacific boundaries of the other dashboard tabs.

| Report | Eligibility and period |
| --- | --- |
| Leads without a next step | Actionable unconverted leads without a future task; period uses lead date |
| Website inquiries without a next step | New/Contacted inquiries without a future task, including unassigned inquiries; period uses received date |
| Unsigned invoices | Signature requested, not signed, order not cancelled/refunded; period uses signature request date; shows the open Signature Follow-up or its absence |
| Shipments without a check in 48 hours | Shipped/In Transit, active order, no future queue Tracking Check due within 48 hours; period uses shipped date, falling back to creation date |
| Completion performance | Manual completions by completing user and reminder type; period uses completion date |

No-next-step reports can be narrowed to a reminder type. User filtering means record agent/assignee for record reports and actual completing staff member for performance. Shipment reports use the linked order's Sales agent for that filter.

On-time completion means completed at/before the final saved due instant, including a rescheduled/snoozed due time. Automatic CRM completions have no completing user and are excluded from staff performance. Queue delay is elapsed minutes after due until manual completion, with early completion counted as zero; queue completion sample size is shown. This avoids negative queue ages and does not attribute all queue work to a named Shipping owner.

Reports are guarded on the backend for Admin, not merely hidden in the UI. Normal pages are bounded to 100 rows. Excel export includes all matching rows up to 10,000; larger result sets require narrower dates or filters. Excel includes no private reminder notes.

## Calendar file export

Calendar → **Export calendar** downloads an authenticated `.ics` snapshot for importing into Google Calendar, Outlook or Apple Calendar. The selected date range and role/filter scope apply; when the view has no range, the UI requests the next 30 days. The existing maximum 62-day range remains. A file contains at most 5,000 events; larger sets require narrower filters.

The exporter uses the same authorized task query as the workspace, stable reminder UIDs, UTC instants, a CRM task link, UTF-8-safe line folding and escaped text. Notes, phone numbers and hidden other-agent task data are not exported. Status-only handoffs retain their existing redaction. A repeating task exports its currently scheduled occurrence, without an RRULE; later occurrences depend on completion in CRM.

The file is a manual snapshot, not a calendar connection or two-way synchronization. CRM edits require a new export; the receiving calendar controls whether re-import updates or duplicates existing events. No Google credentials are required or configured.

## Scheduling settings

User Center → Reminders → **Scheduling preferences** adds:

- One to eight distinct snooze durations, from 1 to 43,200 minutes. The full reminder forms use this list; legacy 15-minute/one-hour notification shortcuts remain valid. Custom-date snoozing stays available.
- Customer calling window start/end and enable/disable. Call/Text scheduling outside the window shows a warning and permits saving. Overnight windows work. The window is interpreted in the task/customer zone.
- Default display zone for users who have not yet chosen a preference. Existing saved preferences are preserved, including first-time inbox acknowledgement behavior.
- State-zone overrides with Arizona's no-DST zone available. Unknown/missing states retain the Pacific customer fallback, independently of the default staff display zone.

Policy changes use version checks and audit records. They do not bulk-rewrite existing reminders. New tasks and record updates use the current state mapping; existing tasks retain their saved zone until their linked record is updated or they are rescheduled. Personal task zones remain user-selected. A state/zone change that cannot preserve a valid local clock uses the existing validation instead of silently corrupting its schedule.

## Migration and APIs

`20261115140000_finish_reminder_settings` adds only new settings columns/defaults and constraints. Existing calling-window values remain in place. No original CRM row is rewritten, no seed/reset is run and no pending task is converted or deleted. SQL uses a transaction with bounded lock/statement waits.

New authenticated paths:

- GET `/reminders/policy`; PATCH is Admin-only and validates the complete policy plus version.
- GET `/reminders/reports`; GET `/reminders/reports/export.xlsx`, both Admin-only.
- GET `/reminders/calendar-export.ics`, with existing task role/ownership scope.
- Existing Leads/Website Leads query endpoints accept `noUpcoming=true`; Orders accepts the role-checked `reminderContext` workspace hint.

Controllers delegate business work to services. Prisma performs persistence. Next routes whitelist paths, validate policy mutations, preserve sessions and proxy binary exports without wrapping files in JSON. Export responses use `no-store`.

## Local validation

- Full backend unit suite: **140 passing tests**, no failures. The four previously established Order/Shipment failures were corrected by supplying current repository shapes in the mocks and checking Sales rejection after its ownership lookup; no production order/shipment business rules were changed to make those tests pass.
- Backend build and frontend TypeScript/production build pass.
- All six phases pass the disposable PostgreSQL workflow suite, including table access isolation, filtered pagination, full matching export, reports, manual completion metrics, UTF-8 calendar content, export MIME types, policy CAS/audits, state overrides, configured snooze and preserved lead activity.
- Migration checks compare all 16 original CRM tables and an existing reminder/settings/rule fixture before/after the Phase 6 migration. Complete Prisma deployment and repeated deployment also run against a second new database.
- Browser review passed against the local production build: Leads' no-upcoming filter excludes the future-follow-up record, retains overdue-only records, and survives detail/back navigation. Its downloaded Excel contains the two matching records and the follow-up column; workbook XML and ZIP integrity checks pass.
- Admin unsigned-invoice and completion-performance reports load with synthetic records. The downloaded report workbook passes XML/ZIP checks. Calendar export downloads ten scheduled occurrences with CRLF, valid folded lines and no recurrence rule.
- Scheduling settings save successfully. Adding a 90-minute choice makes it available in the record snooze form; the review restored the original choices afterward. The customer-local Call/Text window warning is visible and non-blocking.
- The aged-order shortcut opens the correct order/customer/owner context. A synthetic follow-up saved through it appears in the Orders table with customer and staff time zones. Orders and Shipments show their reminder fields in mobile cards; Website Leads' new filter updates its URL.
- A 390 × 844 browser viewport exposed a dialog hidden by its responsive ancestor during rotation/resizing. Reminder forms now portal to the document body; the same open dialog remains visible across the desktop-to-mobile breakpoint, scrolls, and saves successfully. The viewport override was reset after review. This browser check does not substitute for physical-device testing.

The local review helper retains previous synthetic data. `--phase6` adds a clearly labelled aged order/unsigned invoice only if absent. It does not send a signature link or use any real transport. User account `admin@crm.local`, `sales@crm.local` or `shipping@crm.local` uses the local-only review password `LocalDemo123!`.

Physical iPhone/Android testing, actual operating-system push display, real SMTP delivery and production performance/health require controlled release checks. They are not claimed as verified by local browser or mocked transport tests.

## Deployment review

Use [reminders-release-checklist.md](reminders-release-checklist.md). All six reminder migrations remain additive and must be deployed with the matching API/frontend/worker after approval. External delivery remains off until its configuration and controlled staff tests are ready.
