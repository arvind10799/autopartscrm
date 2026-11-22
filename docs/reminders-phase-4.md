# Reminder delivery — Phase 4

## Current behavior

User Center → Reminders shows the time of the last successful worker check-in.
An enabled worker publishes a check-in to the shared Redis cache after a successful
poll, at most once every 30 seconds. The screen shows the worker's channel settings
when its check-in is at most two minutes old. Otherwise it shows the API's
configuration. The timestamp dates the snapshot. A missing check-in can also mean
the cache is unavailable. Verifying receipt requires an enrolled staff device or
a test mailbox. Staff email requires both SMTP credentials and the reminder email switch.

The working marker defaults to 120 minutes and the repeated-snooze flag to three
snoozes. Admin can change both under User Center → Reminders. The staff email
digest and the Day, Week and Month calendar views are implemented.

The original Phase 4 verification used synthetic data and mocked transports. The
deployment and transport activation steps below are historical rollout instructions.

## Behavior

- Existing notification bell adds a server-filtered Reminders category. Alerts group by linked record, retain read/clear behavior, and open a permission-checked task dialog with completion note, 15-minute/1-hour snooze, Working on it, and permitted record navigation. Actions use the current task version. Old/closed alerts cannot reopen tasks or bypass ownership.
- A visible foreground tab uses the existing 45-second bell poll for a concise new-reminder toast. Push arrival requests a refresh. No per-task global browser timers or per-card requests are introduced. Ordinary lead notes and Additional Quotes still generate no bell item.
- Immediate assignment/handoff intents and completion/automatic closure/reassignment intents are recorded in the same database transaction as task changes. Former website assignees receive only a generic reassignment notice; previous private alert text is filtered from their list and count using live record ownership.
- Due and selected early alerts go to the actual owner, or all active Shipping users for queue tasks. Admin receives own due alerts. Second alerts default to 30 minutes overdue for Sales/Shipping; a current active Working on it user receives the queue's second alert, otherwise the active Shipping team does. Admin escalation defaults to 120 minutes and includes the owner and record. It sets the escalation flag and one history event when the bell alert is committed.
- Low/Medium delivery waits outside each recipient's display-zone working hours. High priority and Admin escalations bypass that hold. Overnight shifts and daylight-saving gaps/repeated hours are handled. Held tasks are rechecked before delivery; the current overdue stage replaces stale earlier stages.
- Completion alerts honor Notify me when done and hide receiver-only notes from a handoff sender. Auto-close notifications explain closure to the owner/team. Address/conversion/reassignment hooks cancel old scheduling versions and generate updated assignment intents without changing manual advisers.
- Browser push uses the existing PWA `/sw.js`, importing a push-only handler. Its existing public-static caching remains; private pages, API responses, invoices and uploaded documents are not newly cached. The manifest/icons already present are reused. iPhone guidance explains Add to Home Screen, then Enable notifications.
- Push permission is requested only after pressing Enable. Subscriptions are attached to the authenticated user, limited to 10 devices, and restricted to supported HTTPS push-provider hosts. Logout detaches the browser subscription and clears the worker's account binding. The worker closes old visible notifications on account-binding changes; a mismatched/unbound push displays only a generic message. Expired endpoints are pruned. Successful per-device receipts prevent resending to an already accepted device after a partial fanout failure.
- Staff-only daily SMTP digests run once per local shift date, at the first worker pass during the shift. Sales gets own overdue/today tasks; Shipping gets queue plus own personal tasks; Admin gets team tasks with owner/queue labels. At most 50 tasks are printed with a total and CRM link. Daily digest can be disabled per user. Email fallback runs when push was unavailable or exhausted retries; accepted push suppresses fallback. SMTP delivery is separate from existing invoice mail and RingCentral.

## Worker and reliability

`ReminderWorkerModule` is loaded only by the existing `WorkerModule` (`npm run start:worker`), not by the HTTP application. It polls every five seconds when enabled. A bounded 50-task keyset sweep batches settings/staff lookups and delivery inserts (500 rows per insert), with a cursor that resets at the end. Current Shipping membership is resolved during planning. Deliveries are re-authorized at dispatch, so a stale planning snapshot cannot send a previous scheduling version.

PostgreSQL is the durable source of work. The worker claims one delivery at a time using a conditional update, random fencing token and two-minute lease; another worker can recover expired leases. Each pass processes at most 10 delivery rows and 10 digest recipients. Retries use bounded backoff, with six attempts before Failed. Holds do not consume attempts. Error text stored by the worker is generic and excludes credentials, provider response bodies, endpoints and record notes.

Bell insertion and its Sent acknowledgement share a serializable transaction. Unique delivery keys and unique notification delivery IDs prevent repeated bell entries. Push fanout has per-device receipts and a stable task topic/tag; email has a stable Message-ID. A provider may accept a message immediately before a process/network failure, so absolute exactly-once external delivery is not promised. Cancellation cannot retract an external message already accepted in flight. Browser/device delivery and notification action support depend on the platform; push opens the authenticated CRM dialog for actions rather than making unauthenticated mutations from a service worker.

On restart, the planner coalesces missed early/due/second stages instead of sending each historic stage. Admin escalation remains distinct. Processing is bounded; very large backlogs need operational monitoring rather than assuming every alert is instantaneous. Switch-off stops new worker passes; work already in an external provider may finish.

## User interface and APIs

- My Tasks / Calendar: expand **Reminder preferences & notifications** for display zone, shift start/end, digest preference and browser push controls. Preferences load only while expanded.
- User Center: **Users / Reminders** tabs. Reminders exposes the delivery switch, second alert/escalation delays, working-marker timeout, snooze flag threshold, pending/failed counts, transport configuration indicators and another user's preferences. Backend Admin checks apply.
- Existing preference endpoints accept display zone, working hours and digest preference. New endpoints under `/reminders/notifications`: GET `configuration`, GET/PATCH `settings`, POST `subscribe`, POST `unsubscribe`, GET/POST `alerts/:id`.
- Next proxy routes explicitly whitelist the paths, query options and payloads. No arbitrary backend forwarding or caller-supplied assignee exists.

## Additive migration

`20261114180000_add_reminder_delivery` adds a delivery lock token, nullable reminder/delivery IDs on notifications, default-off delivery setting, push subscriptions, accepted-device receipts and per-shift digest jobs. It adds one delivery-kind enum value and supporting constraints/indexes. It rewrites no existing customer, lead, order, shipment, invoice, note or notification values. Existing notification rows retain null reminder fields and their original behavior.

All migration SQL remains transactional with bounded lock/statement waits. The preservation test excludes only the newly added nullable columns while comparing every original value. The reviewed deployment must include all four phases and the Phase 1 backup/recovery gate. Never reset, force-push a schema or run the general seed against production.

## Future activation configuration

These are configuration names, not secret values. They are not set on AWS by this work.

1. Deploy the reviewed migrations and matching API/frontend/worker after backup verification and approval.
2. Configure `REMINDERS_DELIVERY_ENABLED=true` in the backend API and worker environment. The database `ReminderSettings.deliveryEnabled` defaults to false; leave it off until checks finish.
3. Generate one VAPID keypair for this CRM origin using the installed Web Push library's `generateVAPIDKeys`. Store `REMINDERS_VAPID_PRIVATE_KEY` privately; configure the matching `REMINDERS_VAPID_PUBLIC_KEY` and `REMINDERS_VAPID_SUBJECT` (a valid mailto/HTTPS contact) on API/worker. The frontend obtains only the public key through its session-aware route. Keep the same pair across future deployments.
4. For staff email, configure `REMINDERS_EMAIL_ENABLED=true` in the worker. Reuse `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optional `SMTP_FROM`. It uses the existing SMTP account, without changing invoice templates or sender behavior.
5. Configure the canonical CRM origin in `APP_URL`, or reuse existing `CRM_BASE_URL` / `FRONTEND_URL`. Use the real HTTPS CRM origin for production links and service workers.
6. Start/restart the normal background worker. Confirm health/logs and process supervision. Reminders use PostgreSQL for durable work; existing order BullMQ jobs still use their existing Redis setup.
7. Check User Center → Reminders transport indicators, then enable delivery in that screen. Verify one controlled staff task, push permission/device behavior and one controlled email before wider use. Review old pending tasks and expected catch-up volume before switching on.
8. Future deployment configuration must preserve these settings and the VAPID pair. Rollback/pause: switch delivery off, disable its environment gate and restart the worker if needed. Preserve new database rows and audit history.

## Verification

- Backend build, frontend TypeScript check and frontend production build passed.
- Full backend suite before the final snooze regression case: 104 passed; four independently established baseline Order/Shipment failures remain. The final focused reminder suite has 74 tests, including snooze suppression, delivery-stage coalescing, quiet/overnight shifts, DST starts and push-destination restrictions.
- The real PostgreSQL integration runner passed all four phases, preservation of all 16 original tables, full/repeated Prisma migration deployment, bell deduplication, schedule cancellation, escalation history, quiet hours, retries, expired-lease recovery and fencing, queue recipients, mocked staff fallback/digests, partial push receipts, expired endpoints and former-assignee privacy. It uses disposable synthetic clusters only.
- The installed Web Push module generated an encrypted VAPID request without network I/O. Provider acceptance, operating-system notification display and real-device iPhone/Android behavior require a later controlled transport test; they have not been claimed as tested here.
- The retained localhost review database is resumed without reseeding. `--phase4` adds clearly labelled synthetic preview tasks/notifications only; all external delivery remains disabled in that harness.
- Browser verification on November 15, 2026 passed: Admin bell count and Reminders filter, task deep-link retention while workspace filters normalize, completion with an optional note from the alert dialog, updated task status/count, personal preference save, Admin notification-setting save with delivery still off, and selection/loading of another user's preferences. The Admin notification visibility query has an integration regression check; Prisma's empty-filter behavior must not be used as a true branch inside an OR.

## Remaining phases

Recurring schedules, status suggestions, remaining table follow-up columns/exports, advanced reports and calendar export remain later work. Notification functionality here does not send reminders to customers or add SMS reminder traffic.
