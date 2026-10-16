-- First create Vault secrets operations_relay_url and operations_cron_secret.
-- The URL must be this project's /functions/v1/operations-relay endpoint.
-- Run after enabling pg_cron, pg_net and Vault. No credentials in repository.
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='operations_relay_url') or not exists(select 1 from vault.decrypted_secrets where name='operations_cron_secret') then raise exception 'Configure operations relay Vault secrets first';end if;
 if not exists(select 1 from cron.job where jobname='operations-outbox-delivery') then
 perform cron.schedule('operations-outbox-delivery','*/2 * * * *',$job$
  select net.http_post(url:=(select decrypted_secret from vault.decrypted_secrets where name='operations_relay_url' limit 1),headers:=jsonb_build_object('Content-Type','application/json','X-Cron-Secret',(select decrypted_secret from vault.decrypted_secrets where name='operations_cron_secret' limit 1)),body:='{}'::jsonb,timeout_milliseconds:=120000)
  where exists(select 1 from public.operations_outbox where delivered_at is null and next_attempt_at<=now() and (lease_until is null or lease_until<now()));
 $job$);
 end if;
end $$;
