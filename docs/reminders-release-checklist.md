# Reminders release checklist — approval required

This is a prepared rollout checklist, not a record of actions taken on AWS. The local implementation does not authorize production deployment, database changes or external test messages.

## Review package

- Review the six phase documents and the final code diff, including permissions, notes, recurrence, exports and state mapping.
- Version 5.2 is prepared locally: the sidebar and role-specific What's New popup introduce My Tasks, Calendar, reminders, suggestions, repetition, handoffs and follow-up tools. The new release ID uses the existing per-user acknowledgement; 5.1 acknowledgements remain intact. Publish this configuration with the matching reminder release.
- Confirm the deployed schema baseline and the pending migration list only during the approved rollout.
- Keep the existing CRM SMTP, RingCentral, invoice signing and order-job configuration intact. Preserve the established AWS deployment configuration; do not replace it with the synthetic localhost helper's environment.
- Review local test results: full backend suite, builds, original-table preservation, existing-reminder preservation, complete/repeated migration deployment and browser/file checks.
- Confirm real-device and real-transport checks that remain pending.

## Pending additive migrations

Apply in timestamp order using the normal reviewed Prisma deployment process:

1. `20261114090000_add_reminders_foundation`
2. `20261114120000_add_reminder_origins`
3. `20261114150000_add_reminder_inbox_seen`
4. `20261114180000_add_reminder_delivery`
5. `20261115090000_add_reminder_automation`
6. `20261115140000_finish_reminder_settings`

The existing empty, untracked migration directory is not a deployable migration; do not include it in the migration package. No new migration requires a general seed or existing-customer backfill.

## Before an approved rollout

- Obtain deployment approval for the concrete reviewed change set.
- Verify a recent RDS backup/snapshot and the recovery procedure, with timestamps and the correct database target.
- Record migration status, original table counts, representative record relationships and the active application build/process versions.
- Prepare an application rollback build and a private backup of the current deployment configuration.
- Review SQL against the actual engine and privileges. Bounded lock/statement waits must remain enabled.
- Agree on a quiet rollout window. Delivery gates remain off for the first deployment and checks.

## Approved deployment sequence

1. Deploy the reviewed additive migrations through `prisma migrate deploy` using the existing protected AWS database configuration.
2. Check migration status and compare pre/post original table counts, relationships and representative customer/order/invoice/lead records.
3. Deploy the matching backend API, frontend and background worker through the project's existing AWS/PM2 process.
4. Verify the canonical `https://crm.meeautoparts.com/` application and API/worker health, error logs and assets.
5. Check Admin, Sales and Shipping access; existing order, invoice, shipment, notes and lead workflows; table filters and exports; My Tasks and Calendar; one-time/repeating lifecycle; report totals.
6. Confirm reminder delivery is still disabled while validating existing task volumes and expected catch-up behavior.

Never use database reset, destructive schema push, general seed, migration-history edits that conceal a failure, or dropping reminder tables as a routine rollback.

## Controlled staff notification activation

Follow Phase 4's detailed configuration guide. Configure/preserve the VAPID pair and canonical origin privately. Enable the environment and database delivery gates only after their checks and approval. SMTP fallback uses the existing account, with its reminder-specific enable gate.

Use only explicitly approved staff accounts/devices and recipient addresses for real push/email tests. Check browser permission, iPhone Home Screen installation where required, logout/device cleanup, quiet hours, due/early/overdue stages, handoff and completion deduplication. Check daily digest timing in the user's zone. Customer reminder SMS/email and two-way Google Calendar synchronization are outside this feature.

## Recovery and completion

- If application verification fails, pause reminder delivery and restore the prior application/configuration build as appropriate. Preserve additive tables and any new task/history data.
- A database migration failure needs investigation and a reviewed recovery/retry; do not mark it applied blindly.
- Data recovery follows the verified RDS procedure if needed. Do not assume a restore is harmless to changes made after the snapshot.
- Record deployed versions, migration results, health checks and controlled test outcomes. Publish the prepared 5.2 release notes/sidebar version only with the approved live release.
