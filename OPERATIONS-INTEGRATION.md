# Sending approved indicator reports to SSMPD

Implementation date 2026-10-17. Code and local tests do not constitute live activation.

## Projects

Source (this repository): raocrmssjqsozibniujc.
Destination: uuijfbpgvtdxgaosqpxo, repository mohamedabdelaalhub/SSMPD-Swnw-Social-Media-Prduction-Dashboard.

The complete target schema, recurrence/action/outcome behavior, permissions and worker contract are documented in the destination repository's OPERATIONS-INTEGRATION.md.

## Source activation

1. Apply supabase/migration-operations-outbox.sql after supabase/migration-reports.sql.
2. Set a server-only OPERATIONS_BRIDGE_SECRET of at least 32 random characters, identical to the destination operations-ingest secret. Set a separate OPERATIONS_CRON_SECRET here. Do not store secrets in config.js, a browser or commits.
3. Deploy operations-relay with its index.ts and contract.mjs, using config.toml's JWT setting. The handler checks management Auth for UI calls and the separate cron secret for scheduled calls.
4. Configure source Vault secrets operations_relay_url (this project's /functions/v1/operations-relay endpoint) and operations_cron_secret, enable cron/net/Vault, then apply supabase/operations-cron.sql. Pending reports retry every two minutes after the page closes.
5. Activate the destination SQL, operations-ingest and optional operations-advisor as described in its integration document before end-to-end testing. Release both frontends after activation.

Supabase administrative access was connected on 2026-10-17 (Dubai). See Live activation status below.

## User flow

In خطة العمل, source management reviews the result and chooses a stable branch and report scope, checks approval, and sends the report. This archives the aggregate report and enqueues an immutable snapshot. The UI checks source schema availability before adding an archive row. The delivery status distinguishes queued from delivered, and the user can check pending deliveries again.

The existing local checklist remains a personal review aid. Actual employee assignments, phased execution and outcome review live in the existing SSMPD tasks system after management approves them there.

## Delivery contract

Only projected risk/recommendation/plan fields, numeric KPIs and coverage flags are sent. Raw rows, files, patient identifiers and diagnoses are excluded. The existing anonymized analysis pipeline remains the privacy boundary for text findings. Data coverage accompanies the result so unavailable costs/collections are not interpreted as true zero values.

SHA-256 identifies snapshot content and period/branch/scope. A replay is idempotent. Report title and filename do not establish issue identity. HMAC signs timestamp + exact request body. Receivers reject old timestamps, modified bodies and an unexpected source. The outbox uses a fenced lease and exponential retry; a browser refresh or stale worker cannot acknowledge another worker's claim. No browser receives shared/server keys.

An exact report replay does not increase issue appearances. Revised same-period reports and overlapping windows update evidence without counting another independent recurrence. A new disjoint period records the persistence. Resolution is a separate reviewed outcome, and subsequent evidence can reopen the same issue. Keep the scope stable for the same report family/cadence.

## Tests

Source tests operations-outbox.cjs, operations-export-ui.cjs and operations-relay-handler.cjs exercise permissions, privacy projection, approval/activation gates, dedupe, worker leases, signing and retries. PostgreSQL-compatible tests use PGlite; the test-only digest substitute is not used in production (which uses pgcrypto SHA-256). Existing parser, report, archive and export tests are run as regression checks. No live report or employee task was sent during testing.

## Live activation status — 2026-10-17 (Dubai)

Both database changes are applied. `operations-ingest` and `operations-relay` are deployed and ACTIVE with internal authentication. Their Supabase client dependency is pinned to 2.118.0. Server-only `operations_server_secrets()` reads encrypted Vault entries as a fallback when Edge environment secrets are unset. EXECUTE is revoked from PUBLIC, anon and authenticated. Secrets are not committed. Apply `supabase/operations-vault.sql` in each project before deploying these function versions.

The source has pg_cron/pg_net enabled and `operations-outbox-delivery` active every two minutes. The job invokes the relay only when eligible pending rows exist, so an empty queue does not cause Edge calls. `supabase/operations-extensions.sql` and `operations-activation-hardening.sql` in the source preserve these activation changes. The enqueue SHA-256 call explicitly uses the installed `extensions.digest` schema. Its anon execution grant is revoked explicitly because hosted default privileges can grant it independently of PUBLIC.

A clearly labeled aggregate-only activation report (scope `اختبار التفعيل`, no clinical data or real operating metrics) was delivered with HTTP 200, one source attempt and one destination row. Re-enqueue retained one outbox row. Live task/phase creation, employee visibility, financial RLS isolation, submission/acceptance timing and the home wrapper passed in a rolled-back transaction. No employee assignment from that test remains. The target's `tests/indicator-live-rollback.sql` records the test.

`operations-advisor` deployment was blocked by automatic approval review because it sends report KPIs and execution/outcome context to api.openai.com. It was NOT deployed, retried through another route or invoked. Owner approval of that transfer is pending. The target's `operations_ai_enabled()` flag is false and hides the advisor action. The existing content generator also omits the new operational briefing while this flag is false. Existing content generation behavior otherwise remains unchanged. Deploy the reviewed advisor only after approval, verify it, then enable this flag through a recorded schema change.

The external Claude gateway and scheduled routine were inspected but not modified or invoked. The verified agent account exists. The service-only operations queue is available, but consumption by an external model remains pending its actual routine integration and the data-transfer approval. A stored document alone does not update a running worker.

Supabase advisors were reviewed. Manager-authorized SECURITY DEFINER RPCs are intentional and test their access guards. The two internal audit/quota tables intentionally have RLS with no client policies and no client grants. Existing unrelated advisor findings were not silently changed. Relevant references: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .
