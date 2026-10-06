begin;
create table if not exists public.branch_studies (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 owner_name text not null default '',
 study jsonb not null,
 total numeric not null default 0,
 version bigint not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists branch_studies_owner_idx on public.branch_studies(owner_id);
create table if not exists public.branch_study_members (
 study_id uuid not null references public.branch_studies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 permission text not null check(permission in ('view','add','edit','full')),
 primary key(study_id,user_id)
);
create index if not exists branch_members_user_idx on public.branch_study_members(user_id);
alter table public.branch_studies enable row level security;
alter table public.branch_study_members enable row level security;
-- All access goes through functions which recheck the active profile on every request.
revoke all on public.branch_studies,public.branch_study_members from anon,authenticated;
create or replace function public.branch_permission(sid uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare p text;
begin
 if not exists(select 1 from admins where user_id=auth.uid() and active is not false) then return null; end if;
 if public.is_super() then return 'owner'; end if;
 if exists(select 1 from branch_studies where id=sid and owner_id=auth.uid()) then return 'owner'; end if;
 select permission into p from branch_study_members where study_id=sid and user_id=auth.uid();
 return p;
end $$;
create or replace function public.branch_study_valid(doc jsonb)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare s jsonb; r jsonb; ids text[]='{}'; rids text[];
begin
 if jsonb_typeof(doc) is distinct from 'object' or jsonb_typeof(doc->'id') is distinct from 'string' or coalesce(doc->>'id','')='' or jsonb_typeof(doc->'name') is distinct from 'string' or length(trim(doc->>'name'))=0 or length(doc->>'name')>160 or jsonb_typeof(doc->'sections') is distinct from 'array' then return false; end if;
 for s in select value from jsonb_array_elements(doc->'sections') loop
  if jsonb_typeof(s->'id') is distinct from 'string' or coalesce(s->>'id','')='' or s->>'id'=any(ids) or jsonb_typeof(s->'name') is distinct from 'string' or jsonb_typeof(s->'items') is distinct from 'array' then return false; end if;
  ids=array_append(ids,s->>'id'); rids='{}';
  for r in select value from jsonb_array_elements(s->'items') loop
   if jsonb_typeof(r->'id') is distinct from 'string' or coalesce(r->>'id','')='' or r->>'id'=any(rids) or jsonb_typeof(r->'name') is distinct from 'string' or jsonb_typeof(r->'qty') is distinct from 'number' or jsonb_typeof(r->'unit') is distinct from 'number' then return false; end if;
   if (r->>'qty')::numeric<0 or (r->>'unit')::numeric<0 then return false; end if;
   rids=array_append(rids,r->>'id');
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;
-- add retains every old value; edit retains the exact section/item membership.
create or replace function public.branch_change_allowed(old_doc jsonb,new_doc jsonb,p text)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare s jsonb; ns jsonb; r jsonb; nr jsonb;
begin
 if p in ('owner','full') then return true; end if;
 if p not in ('add','edit') or p is null then return false; end if;
 if old_doc->>'id' is distinct from new_doc->>'id' then return false; end if;
 if p='add' and old_doc->>'name' is distinct from new_doc->>'name' then return false; end if;
 if p='edit' and jsonb_array_length(old_doc->'sections')<>jsonb_array_length(new_doc->'sections') then return false; end if;
 for s in select value from jsonb_array_elements(old_doc->'sections') loop
  select value into ns from jsonb_array_elements(new_doc->'sections') where value->>'id'=s->>'id';
  if ns is null then return false; end if;
  if p='add' and s->>'name' is distinct from ns->>'name' then return false; end if;
  if p='edit' and jsonb_array_length(s->'items')<>jsonb_array_length(ns->'items') then return false; end if;
  for r in select value from jsonb_array_elements(s->'items') loop
   select value into nr from jsonb_array_elements(ns->'items') where value->>'id'=r->>'id';
   if nr is null then return false; end if;
   if p='add' and (r->>'name' is distinct from nr->>'name' or r->'qty' is distinct from nr->'qty' or r->'unit' is distinct from nr->'unit') then return false; end if;
  end loop;
 end loop;
 return true;
end $$;
create or replace function public.branch_studies_list()
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('permission',branch_permission(b.id)) order by b.updated_at desc),'[]'::jsonb)
 from branch_studies b where branch_permission(b.id) is not null
$$;
create or replace function public.branch_study_save(sid uuid,doc jsonb,expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b branch_studies; p text; clean jsonb; cost numeric; profile admins;
begin
 select * into profile from admins where user_id=auth.uid() and active is not false;
 if profile is null then raise exception 'permission denied'; end if;
 if not branch_study_valid(doc) then raise exception 'invalid study'; end if;
 clean=jsonb_build_object('id',doc->>'id','name',trim(doc->>'name'),'sections',doc->'sections');
 select coalesce(sum((r->>'qty')::numeric*(r->>'unit')::numeric),0) into cost
 from jsonb_array_elements(clean->'sections') s cross join lateral jsonb_array_elements(s->'items') r;
 if sid is null then
  if not public.is_super() and profile.role not in ('مدير','محاسب') then raise exception 'permission denied'; end if;
  insert into branch_studies(owner_id,owner_name,study,total) values(auth.uid(),coalesce(profile.name,profile.email,''),clean,cost) returning * into b;
 else
  select * into b from branch_studies where id=sid for update;
  if not found then raise exception 'study unavailable'; end if;
  p=branch_permission(sid);
  if not branch_change_allowed(b.study,clean,p) then raise exception 'permission denied'; end if;
  if expected_version is null or expected_version<>b.version then raise exception 'version conflict'; end if;
  update branch_studies set study=clean,total=cost,version=version+1,updated_at=now() where id=sid returning * into b;
 end if;
 return to_jsonb(b)||jsonb_build_object('permission',branch_permission(b.id));
end $$;
create or replace function public.branch_study_delete(sid uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if branch_permission(sid) is distinct from 'owner' then raise exception 'permission denied'; end if;
 delete from branch_studies where id=sid; return found;
end $$;
create or replace function public.branch_study_users(sid uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if branch_permission(sid) is distinct from 'owner' then raise exception 'permission denied'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',a.name,'email',a.email,'permission',m.permission) order by a.name),'[]'::jsonb)
 from admins a left join branch_study_members m on m.user_id=a.user_id and m.study_id=sid
 where a.active is not false and a.user_id is not null and a.user_id<>(select owner_id from branch_studies where id=sid));
end $$;
create or replace function public.branch_study_share(sid uuid,uid uuid,p text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if branch_permission(sid) is distinct from 'owner' then raise exception 'permission denied'; end if;
 if not exists(select 1 from admins where user_id=uid and active is not false) then raise exception 'user unavailable'; end if;
 if p is null then delete from branch_study_members where study_id=sid and user_id=uid;
 else
  if p not in ('view','add','edit','full') then raise exception 'invalid permission'; end if;
  insert into branch_study_members(study_id,user_id,permission) values(sid,uid,p) on conflict(study_id,user_id) do update set permission=excluded.permission;
 end if;
 return true;
end $$;
-- Retain existing cloud IDs and move old studies out of the shared reports table.
insert into branch_studies(id,owner_id,owner_name,study,total,created_at,updated_at)
select id,created_by,coalesce(created_name,''),payload->'study',
 coalesce((select sum((r->>'qty')::numeric*(r->>'unit')::numeric) from jsonb_array_elements(payload->'study'->'sections') s cross join lateral jsonb_array_elements(s->'items') r),0),created_at,created_at
from reports where payload->>'kind'='branch-study' and created_by is not null and branch_study_valid(payload->'study')
on conflict(id) do nothing;
delete from reports r where payload->>'kind'='branch-study' and exists(select 1 from branch_studies b where b.id=r.id);
-- Block legacy writers after the migration; all clients must use the guarded functions.
create or replace function public.branch_block_legacy()
returns trigger language plpgsql as $$
begin
 if new.payload->>'kind'='branch-study' then raise exception 'use branch study functions'; end if;
 return new;
end $$;
drop trigger if exists branch_block_legacy on public.reports;
create trigger branch_block_legacy before insert or update on public.reports for each row execute function public.branch_block_legacy();
revoke all on function public.branch_permission(uuid),public.branch_study_valid(jsonb),public.branch_change_allowed(jsonb,jsonb,text),public.branch_studies_list(),public.branch_study_save(uuid,jsonb,bigint),public.branch_study_delete(uuid),public.branch_study_users(uuid),public.branch_study_share(uuid,uuid,text),public.branch_block_legacy() from public,anon,authenticated;
grant execute on function public.branch_studies_list(),public.branch_study_save(uuid,jsonb,bigint),public.branch_study_delete(uuid),public.branch_study_users(uuid),public.branch_study_share(uuid,uuid,text) to authenticated;
commit;
