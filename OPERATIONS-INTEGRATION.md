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

The implementation environment lacked connected Supabase administrative access. No live migration, function deployment or cron activation was performed by local tests.

## User flow

In خطة العمل, source management reviews the result and chooses a stable branch and report scope, checks approval, and sends the report. This archives the aggregate report and enqueues an immutable snapshot. The UI checks source schema availability before adding an archive row. The delivery status distinguishes queued from delivered, and the user can check pending deliveries again.

The existing local checklist remains a personal review aid. Actual employee assignments, phased execution and outcome review live in the existing SSMPD tasks system after management approves them there.

## Delivery contract

Only projected risk/recommendation/plan fields, numeric KPIs and coverage flags are sent. Raw rows, files, patient identifiers and diagnoses are excluded. The existing anonymized analysis pipeline remains the privacy boundary for text findings. Data coverage accompanies the result so unavailable costs/collections are not interpreted as true zero values.

SHA-256 identifies snapshot content and period/branch/scope. A replay is idempotent. Report title and filename do not establish issue identity. HMAC signs timestamp + exact request body. Receivers reject old timestamps, modified bodies and an unexpected source. The outbox uses a fenced lease and exponential retry; a browser refresh or stale worker cannot acknowledge another worker's claim. No browser receives shared/server keys.

An exact report replay does not increase issue appearances. Revised same-period reports and overlapping windows update evidence without counting another independent recurrence. A new disjoint period records the persistence. Resolution is a separate reviewed outcome, and subsequent evidence can reopen the same issue. Keep the scope stable for the same report family/cadence.

## Tests

Source tests operations-outbox.cjs, operations-export-ui.cjs and operations-relay-handler.cjs exercise permissions, privacy projection, approval/activation gates, dedupe, worker leases, signing and retries. PostgreSQL-compatible tests use PGlite; the test-only digest substitute is not used in production (which uses pgcrypto SHA-256). Existing parser, report, archive and export tests are run as regression checks. No live report or employee task was sent during testing.
