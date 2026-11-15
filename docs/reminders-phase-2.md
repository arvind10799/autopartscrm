# Record reminders — Phase 2

Status: implemented locally. No AWS access, production migration, deployment, or production-data changes were performed for this phase. Phase 1 and Phase 2 must ship together after a separately approved rollout.

## UI and workflow

The Reminders card appears above the existing Notes section on Website Lead, Lead, Order, Shipment Order/create-shipment, Shipment, and Replacement detail screens. Sales sees the card on its own Sales records; Shipping uses Shipping records; Admin can access both workspaces. Long right columns scroll normally so reminder history does not trap the Notes section offscreen.

- Open and overdue counts, priority, type, creator/assignee, customer-local due time, and the user's display time zone.
- Add/edit dialogs, quick due-time choices, duplicate warning with explicit acknowledgement, optional notes, and early-alert settings.
- Complete with an optional outcome note; snooze for 15 minutes, 1 hour, 1 day, 3 days, or a custom local date/time; cancel with an optional reason; creator/Admin soft deletion; retained audit history.
- Shipping's shared queue has an expiring “Working on it” marker. It does not permanently assign the task or block other Shipping users from completing it.
- Sales can hand an own-order task to Shipping. Shipping can hand a task to the linked order's actual Sales/Admin owner. The server chooses the recipient; the API accepts no arbitrary assignee ID.
- Sales order details show Shipping tasks as a status-only section, plus the latest five completed queue tasks. Shipping notes and completion text are redacted from this section and its audit response; Sales receives no mutation controls for queue tasks.
- Admin-assigned reminders cannot be deleted by the recipient. Sales can edit/cancel reminders it created and can complete/snooze reminders assigned to it.
- On selected lost/unavailable lead statuses, the card offers cancellation guidance while retaining the reminders until explicitly cancelled.

The card uses one bounded record query per refresh; history adds a second query only while expanded. It refreshes on focus, visible-tab changes, local reminder mutations, and every 60 seconds while visible. Abandoned requests are cancelled. This is record-panel refresh only; no global task polling was added.

## Notes and activity

Completing with a nonempty outcome creates one normal note in the same transaction as completion and audit history. Website/Lead outcomes go to that record's notes; Order and Shipment Order outcomes go to order notes; Shipment outcomes go to shipment notes; Replacement outcomes go to its shipment notes when linked, otherwise order notes, with a replacement prefix. Panels refresh the existing Notes UI after a successful action.

Only a completed Lead reminder with an actual outcome note updates the lead activity timestamp. Creating, editing, snoozing, cancelling, deleting, or marking a reminder does not count as touching a lead. Outcome notes do not send ordinary note notifications. Repeated/stale completion is rejected before an additional note can be created.

## Atomic lifecycle changes

The existing repository mutations invoke reminder reconciliation inside their parent database transaction:

| CRM event | Reminder behavior |
| --- | --- |
| Website inquiry reassigned/claimed | Open reminders follow the actual record owner; Admin self-owned reminders stay with Admin. |
| Website inquiry converted | Open reminders move to the resulting Lead and resolve its actual owner. Original website history remains queryable. |
| Website inquiry closed | Pending reminders cancel with a reason. |
| Lead converted to order | “Move open one-time lead reminders to this order” defaults on. Moving resolves the target order owner; opting out cancels pending reminders with a conversion reason. |
| Lead state or dedicated order billing state changes | Pending reminders keep their customer-local clock and recalculate their UTC due time. Invalid/ambiguous daylight-saving times roll back the parent edit with a rescheduling message. |
| Invoice signed | Pending Signature Follow-up reminders complete automatically. |
| Shipment delivered | Tracking Check reminders for the shipment/order stop. Other task types remain available. |
| Shipment cancelled | Pending shipment reminders cancel. |
| Replacement delivered | Pending replacement reminders cancel. |
| Order cancelled/refunded | All pending reminders attached to that order cancel. |

Reconciliation increments row/schedule versions, cancels stale pending delivery rows, and records the transition. A concurrent reminder mutation produces a conflict and rolls back the parent edit instead of overwriting the newer reminder. Automatic Order/Shipment lifecycle outcomes add explanatory internal notes when an actor or active Admin is available. No external messages are sent.

Manual adviser display names do not change record ownership. Inactive or incompatible user owners remain attached for audit and are flagged for Admin on record panels; they are not silently reassigned. A central Admin recovery list belongs with the later My Tasks workspace. Unassigning a website inquiry removes its former agent's access; Admin can manage the retained reminder until reassignment.

Order forms now include a dedicated optional billing-state selector. Existing addresses are not parsed or backfilled. Missing state retains the Pacific fallback. A billing-state-only edit is recognized as an order change and appears in normal order history.

## APIs

Authenticated Nest routes, with business rules in services:

- `GET /reminders/record?context=LEAD&recordId=<uuid>&page=1&history=false` — current tasks, counts, types, allowed assignments, customer/display zones. Pages default to 20, maximum 50.
- `POST /reminders` — validated linked-record context, type, title, local due time, optional assignment/priority/note/alert/duplicate acknowledgement.
- `PATCH /reminders/:id` — `action` plus required `version`; supports `EDIT`, `COMPLETE`, `SNOOZE`, `CANCEL`, `DELETE`, `WORK` and action-specific fields only.
- `GET /reminders/:id/history` — latest 100 audit entries, including retained soft-deleted tasks, subject to the same access policy.

Existing preference routes remain. Next session-aware proxy routes whitelist these operations; no arbitrary backend path forwarding. Ownership, active users, closed records, role/type access, optimistic versions, and clock validation are enforced again on the backend.

## Database changes and rollout

Phase 1 adds the foundation tables and nullable `Order.billingState`. Phase 2 adds only nullable `Reminder.originContext`/`originRecordId`, a paired-null CHECK, and an index in `20261114120000_add_reminder_origins`. These preserve the original source record after conversion. Neither migration deletes or backfills existing CRM data. Both use transactions and bounded lock/statement timeouts.

For a future approved live rollout, follow the backup, migration-status, additive deployment, and record-verification gate in [Phase 1](reminders-phase-1.md). Preserve reminder tables/history when rolling application code back. Never reset or seed the production database.

## Verification

```powershell
# backend
npm run build
node node_modules/jest/bin/jest.js --runInBand
npm run test:reminders:integration

# frontend
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
```

The integration runner creates its own disposable PostgreSQL cluster with synthetic fixtures, applies all 41 historical migrations plus both reminder migrations, compares all 16 original tables, and also checks complete/repeat Prisma migration deployment in a second empty database. Phase 2 exercises actual repository hooks, authenticated APIs, ownership, duplicate acknowledgement, completion-note idempotency, history, state changes/rollback, lead transfer choices, status closure, Shipping redaction, and concurrent completion versus automatic closure. It never loads a production database or connects to AWS.

Visual checks use the actual React card with a synthetic API adapter: scheduling dialog, reminder creation, a narrow card layout, and Sales Shipping status. They do not replace real-device or production end-to-end validation.

Results on 14 November 2026: backend build, frontend production build, frontend TypeScript validation, and all 50 focused Reminder/Lead/Website Lead unit tests passed. The isolated integration runner passed both migrations, unchanged original-table snapshots, actual record lifecycle hooks, the billing-state-only order service edit, concurrent completion versus closure, and complete/repeat Prisma migration deployment. The full suite initially exposed two outdated mocks for the newly transactional claim/actor argument; those were updated and their suites passed. The four previously reproduced baseline Order/Shipment failures remain outside this change.

## Later phases

My Tasks, Calendar, central Admin recovery/assignment views, recurring schedules, notification workers, due/early/overdue delivery, push, email, and completion delivery remain outside this phase. The early-alert and notify-creator options persist configuration for those later workers; Phase 2 does not deliver alerts or customer SMS.
