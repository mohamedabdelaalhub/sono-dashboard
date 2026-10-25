BEGIN;
DO $job$
DECLARE jid bigint;
BEGIN
IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='legacy-dashboard-operations-outbox-delivery') THEN RAISE EXCEPTION 'Legacy schedule already exists'; END IF;
jid:=cron.schedule('legacy-dashboard-operations-outbox-delivery','*/2 * * * *',$command$
 SELECT net.http_post(
 url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='legacy_dashboard_operations_relay_url'),
 headers:=jsonb_build_object('Content-Type','application/json','X-Cron-Secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='legacy_dashboard_operations_cron_secret')),
 body:='{}'::jsonb,timeout_milliseconds:=120000)
 WHERE EXISTS(SELECT 1 FROM legacy_dashboard.operations_outbox WHERE delivered_at IS NULL AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()));
 $command$);
PERFORM cron.alter_job(jid,active:=false);
END $job$;
COMMIT;
