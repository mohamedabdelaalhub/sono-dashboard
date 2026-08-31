-- ============================================================
--  مركز الإشعارات: كل حدث مهم على اللوحة يظهر للسوبر أدمن والمدير.
--  آمن للتشغيل أكثر من مرة.
-- ============================================================

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_id uuid,
  actor_name text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notif insert any admin" on public.notifications;
create policy "notif insert any admin" on public.notifications for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid() and active = true));

drop policy if exists "notif select admin manager" on public.notifications;
create policy "notif select admin manager" on public.notifications for select
  using (exists (
    select 1 from public.admins
    where user_id = auth.uid() and active = true
      and role in ('سوبر أدمن', 'مدير')
  ));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
