-- ============================================================
--  سجل الاستخدام: من دخل، امتى، وأي تقارير رفع، ومدة الاستخدام.
--  آمن للتشغيل أكثر من مرة.
-- ============================================================

create table if not exists public.usage_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.admins(id) on delete cascade,
  email text, name text,
  started_at timestamptz not null default now(),
  ended_at   timestamptz not null default now(),
  reports    text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.usage_log enable row level security;

drop policy if exists "usage insert own" on public.usage_log;
create policy "usage insert own" on public.usage_log for insert
  with check (admin_id = (select id from public.admins where user_id = auth.uid()));

drop policy if exists "usage update own" on public.usage_log;
create policy "usage update own" on public.usage_log for update
  using (admin_id = (select id from public.admins where user_id = auth.uid()));

drop policy if exists "usage select super" on public.usage_log;
create policy "usage select super" on public.usage_log for select
  using (public.is_super());
