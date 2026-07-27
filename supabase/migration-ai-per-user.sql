-- ============================================================
--  ترقية: صلاحية التحليل الذكي لكل مستخدم على حدة
--  شغّله مرة واحدة في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة.
-- ============================================================

-- 1) عمود جديد: هل يُسمح لهذا المستخدم بالتحليل الذكي؟
alter table public.admins
  add column if not exists ai_enabled boolean not null default false;

-- 2) تحديث حارس التعديل ليمنع رفع الصلاحية ذاتياً
create or replace function public.guard_admin_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_super() then return new; end if;
  if new.role       is distinct from old.role
  or new.active     is distinct from old.active
  or new.ai_enabled is distinct from old.ai_enabled then
    raise exception 'غير مسموح بتغيير الدور أو الحالة أو صلاحية التحليل الذكي';
  end if;
  return new;
end $$;

drop trigger if exists admins_guard on public.admins;
create trigger admins_guard before update on public.admins
  for each row execute function public.guard_admin_changes();

-- 3) تسليم المفتاح: السوبر أدمن دائماً،
--    أو المستخدم المسموح له فردياً، أو الجميع لو فُعّل المفتاح العام
create or replace function public.get_ai_key()
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare k text; shared boolean; mine boolean; ok boolean;
begin
  select active, coalesce(ai_enabled, false)
    into ok, mine
    from public.admins
   where user_id = auth.uid();

  if not coalesce(ok, false) then return null; end if;

  if not public.is_super() then
    select coalesce(enable_for_admins, false) into shared
      from public.app_settings where id = 1;
    if not (coalesce(mine, false) or coalesce(shared, false)) then
      return null;
    end if;
  end if;

  select api_key into k from public.app_secrets where id = 1;
  return k;
end $$;

revoke all on function public.get_ai_key() from public;
grant execute on function public.get_ai_key() to authenticated;

-- ============================================================
--  مراجعة
-- ============================================================
-- select email, name, role, active, ai_enabled from public.admins order by created_at;
