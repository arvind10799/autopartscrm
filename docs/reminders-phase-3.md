# My Tasks and Calendar — Phase 3

Status: local implementation. No AWS server, live database, deployment, or customer messaging was used. This builds on the uncommitted Phase 1 foundation and Phase 2 record panels; all three phases must be reviewed/deployed together after approval.

## Workspaces

Sidebar order is Dashboard, My Tasks, Calendar, then the role's existing items. My Tasks owns the badge; Calendar has no badge. The dashboard's My reminders strip and sidebar consume one shared summary provider, refreshed every 60 seconds while visible, on focus, and after reminder mutations. Failed counts show an unavailable indication rather than a false zero.

My Tasks has scope selection, Overdue / Due today / Next 7 days / New handoffs tiles, and All / Overdue / Today / Upcoming / Handed to me / Done / Cancelled tabs. Search is debounced. Record category, task type, priority, effective status, date range, working marker, handoff, owner, and repeated-snooze filters remain in the URL, including the current page. Opening a record and returning restores that URL. Only deliberate filter changes reset pagination.

Cards show task title/type, due time in customer and display zones, priority, customer, sale/order reference or lead date, vehicle/part, relevant record status, assignment origin, and role-appropriate contact/amount/tracking details. Shipping sees customer/state/part and carrier/PRO/BOL without Sales contact/amount fields. Reminder actions reuse the Phase 2 dialogs and backend actions. A completion with a note retains the existing exactly-once note and lead-activity behavior. Touch swipes open Complete or Snooze dialogs; ordinary buttons remain available.

Task/calendar record links include a validated return destination. The existing header back button accepts only the approved local table/workspace roots, now including My Tasks and Calendar, and restores the saved query/page/view. Cross-team handoff audit responses also redact receiver-only outcome text for sender status tracking.

Add task supports personal tasks or an eligible linked record. The record picker is filtered by the actual backend ownership policy. The server derives recipients; arbitrary assignee IDs remain unsupported. Personal tasks choose their own continental US time zone, defaulting to the user's preference.

Calendar offers Agenda, Shipping queue, Day, Week, and Month. Defaults are Sales Agenda, Shipping queue, and Admin Week/Team. Week starts Monday. The selected date, view, filters, colors, and page are retained. Month shows actual matching per-day counts, even when task cards are paginated. Day/Week group tasks in the user's display clock. Tasks can be opened for record navigation, completion, snoozing, editing, working markers, and audit history. Empty slots launch task creation. Dragging an editable task requests confirmation before persisting a new due time.

Drag/slot clocks that fall in an unavailable or repeated DST hour are rejected with guidance to use Edit and an explicit offset. Rescheduling is sent as an absolute instant; the backend converts it into the linked customer's current local clock/zone and applies the ordinary permission/version checks. Phone users retain the Edit dialog rather than depending on dragging.

## Roles and recovery

- Sales Mine includes only user-owned tasks whose linked record still belongs to that user, plus personal tasks. Sent includes only their handoffs on their own orders. Sent queue items are status-only, with notes, completion text, contact/amount details, and mutation controls redacted.
- Shipping Mine includes the shared queue and their personal tasks. Queue is shared; working markers never become permanent ownership. Sent handoffs do not expose raw Sales record relations or Sales contact/amount data.
- Admin has Mine, Team, Queue, Sent, and Unassigned views, plus owner filters. Unassigned dynamically finds inactive/incompatible owners or website inquiries no longer assigned. Opening/working those tasks does not rewrite a manual lead's adviser. Website reassignment continues through the existing website lead workflow.
- Every endpoint checks an active actor. Team/owner filters, recovery lists, repeated-snooze flags, and Follow-ups are guarded on the backend, not only hidden in the UI.

Admin's fourth dashboard tab, Follow-ups, reports open/overdue counts and oldest overdue task for each Sales/Admin owner and the Shipping queue. It includes inactive-owner recovery, repeated-snooze count, and pending handoffs each direction. It uses the dashboard's period selection but computes its own day boundaries in the report/display zone. The three existing dashboard tabs keep their Pacific logic.

## Counts and limits

Due today includes all open tasks due on that display-zone date, including already overdue tasks from the same day. The sidebar badge counts the union of overdue and due today using one predicate, so those tasks are not counted twice. Next 7 days means tomorrow through seven days ahead. Snoozed tasks whose snooze time passed present as Open without writes on reads.

New handoffs include pending received handoffs/Admin assignments created since the viewing user's last explicit inbox acknowledgement. Mark received tasks seen advances a per-user timestamp monotonically using the response's as-of time; it does not change another user's acknowledgement or mark a newly arriving later task seen.

Ordinary list pages have at most 50 tasks; Calendar pages at most 500, with a visible total and pagination. Calendar queries require a date range; workspace ranges are limited to 62 days. Calendar day aggregates are independent of the current task page. More than 5,000 distinct due instants in a range produces an explicit narrow-filter request rather than silently incomplete day counts. Card relations are loaded in one bounded Prisma include query, not one request per card.

## Additive migration

`20261114150000_add_reminder_inbox_seen` adds only nullable `ReminderUserPreference.handoffsSeenAt`. No existing CRM rows are rewritten, no general seed runs, and no ownership/timestamps/addresses are backfilled. The migration is transactional with bounded lock and statement timeouts. Keep the Phase 1/2 migrations and constraints intact.

## APIs

- `GET /reminders/summary` — current actor's task counts, preference zone, and response as-of time.
- `GET /reminders/workspace` — scoped, filtered, paginated cards; counts, permitted types, Admin owner choices, and optional calendar day totals.
- `GET /reminders/records?context=...&search=...` — up to 30 eligible record choices for task creation.
- `GET /reminders/follow-ups` — Admin report with display-zone date bounds.
- `POST /reminders/inbox/seen` — current actor's explicit as-of acknowledgement.
- `PATCH /reminders/:id/reschedule` — version plus future ISO instant, through the existing action service.

Controllers delegate to services. Prisma handles persistence. Next session proxy routes whitelist paths and filters and validate mutation payloads. Existing record routes and action semantics remain available.

## Validation and local review

Run backend build, focused reminder/lead/website unit suites, the synthetic PostgreSQL integration runner, frontend TypeScript checks, and the production frontend build. The integration runner now includes `reminders-phase3.checks.cjs`, testing role scopes, result pagination, display-zone counts, nonduplicated badge counts, calendar aggregates, metadata redaction, record-picker ownership, personal tasks, inactive-owner recovery, acknowledgements, rescheduling including repeated DST hours, and HTTP guards. It also reruns Phase 1/2 preservation/lifecycle checks and complete/repeat Prisma deployment.

The local review launcher is a task helper under `tmp/reminders-localhost.cjs`. It creates a separate loopback-only PostgreSQL cluster and synthetic logins/records, runs the real Nest application with order background delivery stubbed, and runs Next on localhost. It clears inherited application credentials before backend startup and loads no backend production environment file. SMTP/RingCentral credentials are absent. A separate local control endpoint stops only that session; its data directory is retained. This helper is not a production launch/deployment configuration.

Known baseline: four pre-existing Order/Shipment unit failures were independently reproduced before reminder work. They are outside this feature. Live backup, migration, and deployment require a separate approval and the Phase 1 rollout gate.

### Completed local checks — November 14, 2026

- Backend build, frontend TypeScript check, and frontend production build passed.
- Full backend unit suite: 89 passed, four known baseline Order/Shipment failures. All new reminder tests passed.
- Synthetic PostgreSQL integration passed all three reminder phases, including migration preservation of the 16 original CRM tables, concurrency, permissions, cross-team note redaction, DST rescheduling, and complete/repeated Prisma deployment in a second disposable database.
- Browser review covered Sales task completion with an exactly-once lead note, personal-task creation with Eastern/Pacific clocks, retained task search/tab on the record return link, Calendar Agenda/Month, Shipping queue cards and working marker, Admin Follow-ups, and Admin Calendar's Team/Week default. No real-device iPhone or Android testing was performed.
- Local review remains available at `http://localhost:3001` with synthetic `admin@crm.local`, `sales@crm.local`, and `shipping@crm.local` accounts (local-only password: `LocalDemo123!`). The same isolated review database was resumed without reseeding, preserving local review changes. No AWS access or deployment was performed.

## Later phases

No due/early/overdue alert delivery, browser push, SMTP digest, recurring reminders, automatic reminder suggestions, or advanced follow-up reports are activated here. Existing early-alert/notify-creator preferences remain stored for the later delivery phase.
