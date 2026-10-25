# Swnw Dashboard consolidation

Source: `raocrmssjqsozibniujc`
Destination: `uuijfbpgvtdxgaosqpxo`
Application schema: `legacy_dashboard`

The 13 application tables were copied from a transactionally consistent encrypted snapshot. Production now uses the destination. No application data or plaintext provider keys are committed to this repository.

## Cutover outcome

- Application PR #5 was merged and GitHub Pages deployed successfully. The live config, Auth client, Realtime listener, schedule store and HTML cache version were verified.
- All 21 repository tests passed. A signed replay through the deployed operations receiver returned HTTP 200 with `ok: true, duplicate: true`.
- Browser writes and browser-callable RPCs on the old project were disabled after the new site was verified. The old delivery cron was disabled. The final source checksum still matched the migrated snapshot for all 13 tables.
- The destination delivery cron is active. The temporary Auth test account, identity and sessions were removed. The destination retains its original 27 Auth users and 21 SSMPD admin records, plus the five isolated legacy admin records.
- Pausing the old project was rejected by Supabase because it is a paid project. The old project is still active and still incurs applicable charges. Final deletion requires access to Supabase's web dashboard. Do not downgrade the shared organization to Free because SSMPD is in the same organization.
- The web dashboard requires sign-in in this browser. Deletion has not been performed. Keep this status explicit until deletion is confirmed by the provider.

## Database

- Preserve the original columns, 31 constraints, 21 indexes, 27 RLS policies and four triggers.
- Preserve the 20 application functions with references remapped to `legacy_dashboard`.
- Restrict every function search path to its intended schema or an empty path with qualified references.
- Map source Auth UUIDs to destination UUIDs by verified matching email. Preserve application admin IDs and all destination passwords.
- All five active application admins already have destination Auth accounts. Do not overwrite destination Auth users or password hashes.
- Keep `legacy_dashboard.app_secrets.api_key` NULL. Store the provider key in Vault as `legacy_dashboard_ai_api_key`.
- Store bridge and scheduler values under the `legacy_dashboard_operations_*` Vault names. Existing SSMPD secrets retain their names and values.
- Browser roles cannot read `app_secrets`, call `get_ai_key`, or call the server-only key RPC.
- Branch tables remain unavailable through direct browser table access. Their guarded RPCs provide access, matching the source.
- The extra `ai_request_limits` table provides the previously undeployed AI handler's rate limiter. RLS without browser policies on this server-only table is intentional.
- Data API exposes `public, graphql_public, legacy_dashboard`. Realtime includes `legacy_dashboard.notifications`.

The schema, grants, Vault AI functions, inactive cron setup and rollback-only verification SQL live in the adjacent `legacy-dashboard-*.sql` files. These are one-time migration records, not initialization scripts to rerun against an existing schema.

Do not run the old `setup.sql` or `migration-*.sql` files against the consolidated project. Those historical files explicitly target `public` and could change SSMPD tables.

## Application

The browser and both Edge Functions use `db: { schema: 'legacy_dashboard' }`. Realtime uses the same configured schema. Both functions validate authentication in their handlers. `dashboard-ai` reads the provider key only through a service-role-only Vault RPC.

The operations envelope retains `source: 'raocrmssjqsozibniujc'` as its logical source identifier. The existing receiver validates that contract. This identifier is not a connection to the old project.

The schedule store previously requested a nonexistent `SonoAuth.sb()` accessor and silently stored schedules only in localStorage. It now uses `SonoAuth.client()` and retains the local copy. The source database contained zero schedule rows. Device-local schedules remain in `sono.schedule.v1` and are not overwritten by migration.

Users sign in with the destination SSMPD account password. Sessions from the old project do not authenticate to the destination. Refresh the page and sign in again after cutover.

## Verification

- All 13 tables passed full-row checksum comparison after documented UUID mapping. API-key metadata matched separately, while actual keys were compared to Vault without displaying their values.
- Original application counts: admins 5, settings 1, secrets metadata 1, reports 5, schedule 0, tab access 4, Amida settings 1, Amida archive 2, usage 0, notifications 43, studies 1, study members 1, operations outbox 2.
- Owner, manager, accountant and unrelated SSMPD-user RLS tests passed.
- Transaction-rollback tests covered report and schedule writes, Amida updates, study create/update/delete, notifications, owner protection, rate limits and queue leasing.
- Real destination Auth password login, refresh and logout passed with a temporary test account. That account, its identity and sessions were removed.
- Real authenticated Data API, branch RPC and deployed AI health tests passed. Direct study-table and provider-key access were denied.
- The repository regression tests and migration client test passed. The SSMPD `public.admins` rows and 27 existing Auth accounts were preserved.
- No paid AI generation request was made. AI handler health and configuration were verified.

## Cutover and rollback

1. Confirm the source is still writable only by the existing production application and its cron job.
2. Recheck source and destination checksums before switching. If they differ, synchronize the changed data with the same UUID map before proceeding.
3. Publish this commit to the GitHub Pages branch and verify the served config, auth client, notification subscription and schedule store have the new cache version.
4. Stop the source project's operations cron and fence browser writes/RPCs with `legacy-dashboard-source-cutover.sql`, then compare the source to the verified snapshot. Enable `legacy-dashboard-operations-outbox-delivery` in the destination. Never leave both delivery schedules active.
5. Verify the deployed page and destination endpoints. Pause the old project after these checks. Do not delete the rollback copy before the owner has verified their normal workflow.

If reverting before new production writes, disable the destination cron and restore the previous frontend commit. Restore the source project if paused, then restore its original browser privileges and cron using `legacy-dashboard-source-rollback.sql`. If the destination has accepted new production writes, reconcile those writes back to the source with the reverse UUID map before reverting. A frontend-only revert after new writes can lose work.

