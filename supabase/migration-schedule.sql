-- ============================================================
--  ترقية: جدول العيادات كمرجع دائم
--  شغّل هذا الملف مرة واحدة في Supabase → SQL Editor
-- ============================================================

create table if not exists public.clinic_schedule (
  id          int primary key default 1,
  payload     jsonb not null,
  file_name   text,
  saved_by    uuid references auth.users(id) on delete set null,
  saved_email text,
  updated_at  timestamptz not null default now(),
  constraint one_schedule check (id = 1)
);

alter table public.clinic_schedule enable row level security;

drop policy if exists "all read schedule"    on public.clinic_schedule;
drop policy if exists "super writes schedule" on public.clinic_schedule;

-- كل مستخدم مُفعَّل يقرأ الجدول
create policy "all read schedule"
  on public.clinic_schedule for select to authenticated
  using (exists (select 1 from public.admins
                 where user_id = auth.uid() and active));

-- السوبر أدمن ومن له صلاحية الرفع هما فقط من يحدّثانه
create policy "super writes schedule"
  on public.clinic_schedule for all to authenticated
  using (public.is_super()) with check (public.is_super());

comment on table public.clinic_schedule is
  'جدول عيادات المركز: أطباء وتخصصات وأيام ومواعيد وأسعار — بيانات مرجعية ثابتة لا تتغيّر مع كل رفعة تقارير.';
