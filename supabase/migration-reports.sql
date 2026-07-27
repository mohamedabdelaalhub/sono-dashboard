-- ============================================================
--  ترقية: أرشيف التحليلات المحفوظة
--  شغّله مرة واحدة: SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة.
-- ============================================================

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  period_from  date,
  period_to    date,
  files        text[]      not null default '{}',
  revenue      numeric     not null default 0,
  cost         numeric     not null default 0,
  net          numeric     not null default 0,
  score        int         not null default 0,
  risk_count   int         not null default 0,
  payload      jsonb       not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_name text,
  created_at   timestamptz not null default now()
);

create index if not exists reports_created_idx on public.reports (created_at desc);
create index if not exists reports_period_idx  on public.reports (period_from, period_to);

alter table public.reports enable row level security;

drop policy if exists "active read reports"   on public.reports;
drop policy if exists "uploaders add reports" on public.reports;
drop policy if exists "owner deletes reports" on public.reports;

-- كل مستخدم نشط يقرأ الأرشيف
create policy "active read reports"
  on public.reports for select to authenticated
  using (exists (select 1 from public.admins
                 where user_id = auth.uid() and active));

-- من له صلاحية رفع الملفات يحفظ تقريراً (كل الأدوار عدا «مستخدم»)
create policy "uploaders add reports"
  on public.reports for insert to authenticated
  with check (exists (select 1 from public.admins
                      where user_id = auth.uid() and active
                        and role in ('سوبر أدمن','سوبر ادمن','مالك','مدير','محاسب')));

-- الحذف: صاحب التقرير أو السوبر أدمن
create policy "owner deletes reports"
  on public.reports for delete to authenticated
  using (created_by = auth.uid() or public.is_super());

-- ============================================================
--  مراجعة
-- ============================================================
-- select title, period_from, period_to, revenue, net, score, created_name, created_at
-- from public.reports order by created_at desc;

-- حذف تقرير بعينه:
-- delete from public.reports where id = 'ضع-المعرّف-هنا';
