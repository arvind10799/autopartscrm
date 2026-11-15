# Reminders foundation — Phase 1

Status: local implementation only. This phase does not authorize AWS deployment or a production migration.

This document records the foundation phase. The local Phase 2 implementation and operational routes are described in [reminders-phase-2.md](reminders-phase-2.md).

## Scope

- Six new tables: `ReminderType`, `Reminder`, `ReminderHistory`, `ReminderDelivery`, `ReminderUserPreference`, `ReminderSettings`.
- One existing-table change: nullable `Order.billingState` (US state code). Existing free-text addresses and all existing field values are retained. No address parsing or data backfill.
- Record ownership and action policy, customer-local scheduling, atomic reminder/history persistence, and optimistic concurrency for Shipping markers.
- Preference APIs: authenticated `GET/PATCH /reminders/preferences/me`; Admin-only `GET/PATCH /reminders/preferences/users/:userId`. Pacific defaults are returned without inserting rows for existing users.
- Internal `RemindersService` creation/read/marker methods for the next phase. Task creation and mutation HTTP routes are deliberately introduced with Phase 2, so a foundation-only deployment cannot create tasks without the corresponding UI/lifecycle integration.

No panels, calendar, polling, push subscriptions, email, SMS, recurrence, automatic conversion/reassignment, escalation, or worker scheduling are enabled in this phase. No change to existing dashboard Pacific boundaries. The new billing-state field will be exposed with the later form and rescheduling hooks.

## Ownership and integrity

The server resolves owners using IDs, never adviser display names. Manual lead and order owners are their existing `createdById`; website inquiries use `assignedToId`; Shipping records use the shared queue. Personal tasks belong to the creator. Admin can create a self-owned record reminder; an unassigned website inquiry otherwise needs an assignee first.

Sales can start tasks only on their own website inquiries, unconverted leads, orders, or personal tasks. Sales-to-Shipping handoffs start on an own order. Shipping-to-Sales handoffs start on a Shipping record and resolve the linked order agent. No arbitrary assignee ID is accepted. Read-only sender tracking does not grant access to the receiver's workspace. Former website assignees lose access even if a stored reminder has not yet been moved by the Phase 2 lifecycle hooks.

Shipping queue markers use serializable transactions and version checks. One competing marker succeeds; the other receives a conflict. Marker expiry defaults to 120 minutes. A separate `scheduleVersion` is reserved for scheduling changes; marker updates must not invalidate alerts.

Every persisted reminder has a valid context/record shape and owner shape. Foreign keys protect linked records and history from hard deletion. User deletion checks include reminder activity and preferences; deactivate such users instead of removing audit history. Soft reminder deletion will retain history. Completion notes and activity updates are wired in Phase 2; creating a reminder here never touches a lead's `updatedAt` or creates a record note.

`ReminderDelivery` is a durable scheduling/outbox foundation. A unique key across reminder, schedule version, recipient, delivery kind, and channel prevents duplicate scheduling rows. Actual delivery and recovery are Phase 4 work; transport-level delivery guarantees are not claimed here.

## Scheduling

- Customer records resolve from lead state or the linked order's dedicated billing-state field. Missing/unrecognised/noncontinental states fall back to Pacific.
- Main-zone mapping uses Los Angeles, Denver, Chicago, New York; Arizona uses Phoenix without daylight saving.
- Personal tasks use a chosen display zone, defaulting to the user's preference, then Pacific.
- Persist the local clock (`YYYY-MM-DDTHH:mm`), IANA zone, and UTC instant together. Never use a fixed PT/ET offset.
- Invalid dates and past/equal due times are rejected. Nonexistent spring-forward times are rejected. Repeated fall-back times require an explicit UTC offset to disambiguate.
- The clock-to-zone function can rebase open reminders while preserving the customer clock. Automatically invoking it on state/address changes belongs to Phase 2, before exposing task APIs.
- Display preferences support PT/MT/CT/ET. Working hours are local minutes, support overnight shifts, and cannot have identical start/end values. Default shift is 09:00–17:00; it is configurable groundwork, not active alert deferral.

## Migration review

Migration: `backend/prisma/migrations/20261114090000_add_reminders_foundation/migration.sql`.

The SQL adds enums, tables, indexes, foreign keys, and checks. It inserts the specification's reminder types and default reminder settings into the NEW tables only. It does not run the general CRM seed, delete/truncate old records, change owners, alter addresses, or update existing timestamps.

The migration is transactional, with a 5-second lock wait and 60-second statement timeout. A timeout requires investigating and retrying the migration; do not bypass the failure or mark it applied without checking the database. Constraints on new tables complement application validation. Preserve the explicit CHECK constraints in future migration reviews because Prisma schema syntax does not represent them.

## Verification commands

From `backend/`:

```powershell
npm run build
node node_modules/jest/bin/jest.js --runInBand modules/reminders
npm run test:reminders:integration
```

The integration runner requires PostgreSQL binaries (default `C:/Program Files/PostgreSQL/18/bin`; override with `REMINDERS_TEST_PG_BIN`). It creates a fresh cluster on a dynamically selected loopback port under the repository's `tmp/`, creates synthetic fixtures, and stops/removes only its own verified cluster directory. It never reads `.env` for its connection or uses an existing PostgreSQL data directory. Its explicit test URLs point only at the cluster it started. On failure to stop the cluster, the runner retains its directory for inspection.

Checks include all previous migration SQL, before/after snapshots of every existing table, owner restrictions and handoffs, active users, closed records, no lead timestamp changes, marker races/expiry, audit rollback, delivery uniqueness, foreign keys, and a second database with full `prisma migrate deploy` plus repeat deployment. Unit tests cover permissions, preferences, and time-zone/DST boundaries.

### Results on 14 November 2026

- Prisma schema validation/client generation and backend build passed.
- All new reminder unit tests passed. The complete backend suite reported 76 passing and 4 failing tests; the same four Order/Shipment failures were reproduced using a temporary copy of the pre-change Git revision. These existing failures are outside this phase.
- The isolated PostgreSQL 18 integration runner applied 41 historical migration files, inserted synthetic CRM fixtures, applied this migration, and confirmed unchanged snapshots across all 16 original tables (excluding only the new nullable Order field).
- Ownership, handoffs, disabled users, preference defaults/updates, concurrent queue markers, marker expiry, audit rollback, delivery deduplication, and new foreign-key/CHECK protections passed.
- Actual authenticated preference routes passed unauthenticated/disabled-user rejection, cross-user Admin authorization, and DTO validation. The user deletion guard preserved a user referenced by a new personal reminder.
- Full Prisma migration deployment and repeat deployment passed on a second disposable database. The runner stages SQL/schema files outside any `.env` directory. One pre-existing, empty, untracked local migration folder was omitted from that staged package; it was not changed or removed.
- No AWS connection, production migration, customer-data restore, or general CRM seed was used.

## Future live rollout gate

Before any approved production rollout: verify the RDS backup/snapshot and recovery procedure; record schema migration status and existing table counts; review this SQL against the target engine; apply the reviewed migration using `prisma migrate deploy`; compare original counts/relationships and sample records; deploy the matching application and verify services. Never use `migrate reset`, `db push --accept-data-loss`, or the general seed against live data. Rolling back application code does not require removing these additive tables; preserve any new reminder data.

Phase 2 must complete conversion, reassignment, inactive-owner handling, state-change rescheduling, outcome notes, and lifecycle mutations before exposing operational task routes. Push, My Tasks, and Calendar remain later phases as agreed.
