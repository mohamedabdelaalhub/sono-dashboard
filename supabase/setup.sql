-- ============================================================
--  إعداد Supabase — لوحة مركز عيادات سونو
--  شغّله مرة واحدة: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة.
-- ============================================================

-- ============================================================
--  1) جدول المستخدمين المصرّح لهم
-- ============================================================
create table if not exists public.admins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  email       text not null unique,
  name        text,
  role        text not null default 'مستخدم',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ترقية من نسخة أقدم كان مفتاحها user_id
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='admins' and column_name='id') then
    alter table public.admins add column id uuid default gen_random_uuid();
  end if;
end $$;

create index if not exists admins_email_idx on public.admins (lower(email));

-- ============================================================
--  2) دالة فحص السوبر أدمن
--  SECURITY DEFINER تتجاوز RLS، وبدونها تدخل السياسات في تكرار لا نهائي.
-- ============================================================
create or replace function public.is_super()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid()
      and active
      and role in ('سوبر أدمن', 'سوبر ادمن', 'مالك')
  );
$$;

revoke all on function public.is_super() from public;
grant execute on function public.is_super() to authenticated;

-- ============================================================
--  3) سياسات جدول المستخدمين
-- ============================================================
alter table public.admins enable row level security;

drop policy if exists "admins read own row"      on public.admins;
drop policy if exists "owner manages admins"     on public.admins;
drop policy if exists "read own or pending"      on public.admins;
drop policy if exists "super reads all"          on public.admins;
drop policy if exists "super writes all"         on public.admins;
drop policy if exists "claim own invite"         on public.admins;

-- كل مستخدم يقرأ سطره، أو سطر دعوة معلّقة بنفس بريده (لازم لتفعيل الحساب)
create policy "read own or pending"
  on public.admins for select to authenticated
  using (
    user_id = auth.uid()
    or (user_id is null and lower(email) = lower(auth.jwt() ->> 'email'))
  );

-- السوبر أدمن يقرأ الجميع
create policy "super reads all"
  on public.admins for select to authenticated
  using (public.is_super());

-- السوبر أدمن يضيف ويعدّل ويحذف
create policy "super writes all"
  on public.admins for all to authenticated
  using (public.is_super())
  with check (public.is_super());

-- ربط الدعوة المعلّقة بالحساب عند أول دخول — لا يسمح بتغيير الدور
create policy "claim own invite"
  on public.admins for update to authenticated
  using (user_id is null and lower(email) = lower(auth.jwt() ->> 'email'))
  with check (user_id = auth.uid());

-- منع رفع الدور ذاتياً: أي تعديل على role أو active من غير سوبر أدمن يُرفض
create or replace function public.guard_admin_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_super() then return new; end if;
  if new.role is distinct from old.role or new.active is distinct from old.active then
    raise exception 'غير مسموح بتغيير الدور أو الحالة';
  end if;
  return new;
end $$;

drop trigger if exists admins_guard on public.admins;
create trigger admins_guard before update on public.admins
  for each row execute function public.guard_admin_changes();

-- ============================================================
--  4) إعدادات الذكاء الاصطناعي (عامة — بلا مفتاح)
-- ============================================================
create table if not exists public.app_settings (
  id                   int primary key default 1,
  provider             text default 'anthropic',
  model                text default 'claude-sonnet-5',
  enable_for_admins    boolean not null default false,
  include_doctor_names boolean not null default true,
  has_key              boolean not null default false,
  updated_at           timestamptz not null default now(),
  constraint one_row check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "all read settings"   on public.app_settings;
drop policy if exists "super writes settings" on public.app_settings;

create policy "all read settings"
  on public.app_settings for select to authenticated using (true);

create policy "super writes settings"
  on public.app_settings for all to authenticated
  using (public.is_super()) with check (public.is_super());

-- ============================================================
--  5) المفتاح نفسه — جدول منفصل لا يقرؤه إلا السوبر أدمن
-- ============================================================
create table if not exists public.app_secrets (
  id         int primary key default 1,
  api_key    text,
  updated_at timestamptz not null default now(),
  constraint one_row_secret check (id = 1)
);

alter table public.app_secrets enable row level security;
drop policy if exists "super only secrets" on public.app_secrets;

create policy "super only secrets"
  on public.app_secrets for all to authenticated
  using (public.is_super()) with check (public.is_super());

-- دالة تُسلّم المفتاح لباقي المستخدمين فقط عندما يفعّل السوبر أدمن المشاركة.
-- المفتاح لا يظهر في أي استعلام مباشر — فقط من خلال هذه الدالة.
create or replace function public.get_ai_key()
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare k text; shared boolean; allowed boolean;
begin
  select exists (select 1 from public.admins where user_id = auth.uid() and active)
    into allowed;
  if not allowed then return null; end if;

  select enable_for_admins into shared from public.app_settings where id = 1;
  if not coalesce(shared, false) and not public.is_super() then return null; end if;

  select api_key into k from public.app_secrets where id = 1;
  return k;
end $$;

revoke all on function public.get_ai_key() from public;
grant execute on function public.get_ai_key() to authenticated;

-- ============================================================
--  6) أول سوبر أدمن
-- ============================================================
-- الخطوة أ) Authentication → Users → Add user → Create new user
--            ضع بريدك وكلمة السر، وفعّل «Auto Confirm User».
-- الخطوة ب) غيّر البريد والاسم في السطر التالي ثم شغّله:

insert into public.admins (user_id, email, name, role, active)
select u.id, u.email, 'محمد عبدالعال', 'سوبر أدمن', true
from auth.users u
where lower(u.email) = lower('mohamadmh32@gmail.com')
on conflict (email) do update
  set user_id = excluded.user_id,
      role    = 'سوبر أدمن',
      name    = excluded.name,
      active  = true;

-- ============================================================
--  7) مراجعة
-- ============================================================
-- select email, name, role, active, (user_id is not null) as حساب_مفعل
-- from public.admins order by created_at;

-- إيقاف شخص دون حذفه:
-- update public.admins set active = false where email = 'someone@example.com';

-- ============================================================
--  ملاحظة: بعد التشغيل، أضف باقي المستخدمين من داخل اللوحة نفسها
--  (⚙ لوحة التحكم ← المستخدمون والصلاحيات) — لا حاجة لأي SQL بعد الآن.
-- ============================================================
