-- ============================================================
--  ترقية: التحكم في التابات المسموحة لكل مستخدم
--  شغّله مرة واحدة: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة. لا يمسّ أي جدول موجود.
-- ============================================================

create table if not exists public.tab_access (
  admin_id   uuid primary key references public.admins(id) on delete cascade,
  tabs       text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.tab_access enable row level security;

drop policy if exists "read own tab access"     on public.tab_access;
drop policy if exists "super writes tab access" on public.tab_access;

-- كل مستخدم يقرأ صفّه فقط (ليعرف هو نفسه أي تابات مسموحة له)؛ السوبر أدمن يقرأ الجميع
create policy "read own tab access"
  on public.tab_access for select to authenticated
  using (
    admin_id in (select id from public.admins where user_id = auth.uid())
    or public.is_super()
  );

-- السوبر أدمن فقط يضيف أو يعدّل أو يحذف
create policy "super writes tab access"
  on public.tab_access for all to authenticated
  using (public.is_super())
  with check (public.is_super());
