begin;
alter table public.admins add column if not exists ai_enabled boolean not null default false;
-- Apply only after dashboard-ai is deployed. Existing keys remain on the server.
create or replace function public.set_ai_key(new_key text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_super() then raise exception 'permission denied'; end if;
  insert into public.app_secrets(id,api_key,updated_at)
  values(1,nullif(trim(new_key),''),now())
  on conflict(id) do update set api_key=excluded.api_key,updated_at=excluded.updated_at;
  update public.app_settings set has_key=(nullif(trim(new_key),'') is not null),updated_at=now() where id=1;
  return true;
end $$;
revoke all on function public.set_ai_key(text) from public;
grant execute on function public.set_ai_key(text) to authenticated;
revoke all on function public.get_ai_key() from public,anon,authenticated;
revoke select on public.app_secrets from anon,authenticated;
create table if not exists public.ai_request_limits(
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket timestamptz not null,
  count integer not null default 1,
  primary key(user_id,bucket)
);
alter table public.ai_request_limits enable row level security;
create or replace function public.consume_ai_request(uid uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare used integer;
begin
  insert into public.ai_request_limits(user_id,bucket) values(uid,date_trunc('minute',now()))
  on conflict(user_id,bucket) do update set count=ai_request_limits.count+1
  returning count into used;
  delete from public.ai_request_limits where bucket<now()-interval '1 day';
  return used<=5;
end $$;
revoke all on function public.consume_ai_request(uuid) from public,anon,authenticated;
grant execute on function public.consume_ai_request(uuid) to service_role;
commit;
