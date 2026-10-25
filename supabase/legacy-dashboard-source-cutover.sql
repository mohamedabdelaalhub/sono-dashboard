-- Run only against source project raocrmssjqsozibniujc after the new site is live.
BEGIN;
DO $guard$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='legacy_dashboard') THEN
  RAISE EXCEPTION 'Refusing to fence the consolidated destination project';
 END IF;
 IF to_regclass('public.operations_outbox') IS NULL OR to_regclass('public.branch_studies') IS NULL THEN
  RAISE EXCEPTION 'Source application schema not found';
 END IF;
END $guard$;
SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='operations-outbox-delivery';
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
COMMIT;
