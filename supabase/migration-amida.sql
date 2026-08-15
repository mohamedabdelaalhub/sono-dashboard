-- ============================================================
--  ترقية: تاب «توزيع أرباح الأميدا» (تاب حساس — مخفي افتراضياً)
--  شغّله مرة واحدة: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة. لا يمسّ أي جدول موجود.
--
--  الوصول للبيانات هنا مربوط بنفس صلاحية إظهار التاب في
--  جدول tab_access: لازم تشغّل migration-tab-access.sql قبل هذا
--  الملف لو لسه ماشغلتوش.
-- ============================================================

-- هل المستخدم الحالي سوبر أدمن أو ممنوح تاب "amida"؟
create or replace function public.can_access_amida()
returns boolean language sql stable as $$
  select public.is_super() or exists (
    select 1 from public.admins a
    join public.tab_access ta on ta.admin_id = a.id
    where a.user_id = auth.uid() and 'amida' = any(ta.tabs)
  );
$$;

-- ---------- الإعداد الحالي (مسودة واحدة تُحفظ تلقائياً أثناء التعديل) ----------
create table if not exists public.amida_settings (
  id           int primary key default 1,
  principal    numeric not null default 0,
  annual_rate  numeric not null default 0,
  partners     jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  constraint one_row_amida check (id = 1)
);
insert into public.amida_settings (id) values (1) on conflict (id) do nothing;

alter table public.amida_settings enable row level security;
drop policy if exists "amida granted read settings"  on public.amida_settings;
drop policy if exists "amida granted write settings" on public.amida_settings;

create policy "amida granted read settings"
  on public.amida_settings for select to authenticated
  using (public.can_access_amida());

create policy "amida granted write settings"
  on public.amida_settings for all to authenticated
  using (public.can_access_amida()) with check (public.can_access_amida());

-- ---------- سجل الأرشفة (كل توزيعة فعلية تُحفظ كسطر جديد) ----------
create table if not exists public.amida_archive (
  id           uuid primary key default gen_random_uuid(),
  principal    numeric not null,
  annual_rate  numeric not null,
  partners     jsonb not null,           -- [{name, pct, annual, period}]
  period_total numeric not null,         -- إجمالي التوزيعة الحالية (كل ٤ أشهر)
  annual_total numeric not null,
  note         text,
  created_by   text,
  created_at   timestamptz not null default now()
);

alter table public.amida_archive enable row level security;
drop policy if exists "amida granted read archive"  on public.amida_archive;
drop policy if exists "amida granted write archive" on public.amida_archive;

create policy "amida granted read archive"
  on public.amida_archive for select to authenticated
  using (public.can_access_amida());

create policy "amida granted write archive"
  on public.amida_archive for insert to authenticated
  with check (public.can_access_amida());

create policy "amida granted delete archive"
  on public.amida_archive for delete to authenticated
  using (public.can_access_amida());
