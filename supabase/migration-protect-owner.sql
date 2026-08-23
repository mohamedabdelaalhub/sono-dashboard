-- ============================================================
--  استعادة حساب المالك كسوبر أدمن، وحمايته نهائياً من التعديل/الحذف/الإيقاف
--  آمن للتشغيل أكثر من مرة.
-- ============================================================

update public.admins set role = 'سوبر أدمن', active = true
where email = 'mohamadmh32@gmail.com';

create or replace function public.protect_owner_admin()
returns trigger language plpgsql as $$
begin
  if old.email = 'mohamadmh32@gmail.com' and (new.role <> 'سوبر أدمن' or new.active = false) then
    raise exception 'هذا الحساب سوبر أدمن دائم — لا يمكن تغيير دوره أو إيقافه.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_owner_admin on public.admins;
create trigger trg_protect_owner_admin
  before update on public.admins
  for each row execute function public.protect_owner_admin();

create or replace function public.protect_owner_admin_delete()
returns trigger language plpgsql as $$
begin
  if old.email = 'mohamadmh32@gmail.com' then
    raise exception 'هذا الحساب سوبر أدمن دائم — لا يمكن حذفه.';
  end if;
  return old;
end;
$$;
drop trigger if exists trg_protect_owner_admin_delete on public.admins;
create trigger trg_protect_owner_admin_delete
  before delete on public.admins
  for each row execute function public.protect_owner_admin_delete();
