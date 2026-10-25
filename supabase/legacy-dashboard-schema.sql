BEGIN;
CREATE SCHEMA legacy_dashboard;
REVOKE ALL ON SCHEMA legacy_dashboard FROM PUBLIC;
SET LOCAL search_path = legacy_dashboard, pg_catalog;
CREATE TABLE legacy_dashboard.app_settings (id integer DEFAULT 1 NOT NULL, provider text DEFAULT 'anthropic'::text, model text DEFAULT 'claude-sonnet-5'::text, enable_for_admins boolean DEFAULT false NOT NULL, include_doctor_names boolean DEFAULT true NOT NULL, has_key boolean DEFAULT false NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE legacy_dashboard.app_secrets (id integer DEFAULT 1 NOT NULL, api_key text, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE legacy_dashboard.admins (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid, email text NOT NULL, name text, role text DEFAULT 'مستخدم'::text NOT NULL, active boolean DEFAULT true NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, ai_enabled boolean DEFAULT false NOT NULL);
CREATE TABLE legacy_dashboard.reports (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, period_from date, period_to date, files text[] DEFAULT '{}'::text[] NOT NULL, revenue numeric DEFAULT 0 NOT NULL, cost numeric DEFAULT 0 NOT NULL, net numeric DEFAULT 0 NOT NULL, score integer DEFAULT 0 NOT NULL, risk_count integer DEFAULT 0 NOT NULL, payload jsonb NOT NULL, created_by uuid, created_name text, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE legacy_dashboard.clinic_schedule (id integer DEFAULT 1 NOT NULL, payload jsonb NOT NULL, file_name text, saved_by uuid, saved_email text, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE legacy_dashboard.tab_access (admin_id uuid NOT NULL, tabs text[] DEFAULT '{}'::text[] NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE legacy_dashboard.usage_log (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, admin_id uuid NOT NULL, email text, name text, started_at timestamp with time zone DEFAULT now() NOT NULL, ended_at timestamp with time zone DEFAULT now() NOT NULL, reports text[] DEFAULT '{}'::text[] NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE legacy_dashboard.amida_settings (id integer DEFAULT 1 NOT NULL, principal numeric DEFAULT 0 NOT NULL, annual_rate numeric DEFAULT 0 NOT NULL, partners jsonb DEFAULT '[]'::jsonb NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, exchange_rate numeric DEFAULT 75 NOT NULL, deduction numeric DEFAULT 5 NOT NULL);
CREATE TABLE legacy_dashboard.amida_archive (id uuid DEFAULT gen_random_uuid() NOT NULL, principal numeric NOT NULL, annual_rate numeric NOT NULL, partners jsonb NOT NULL, period_total numeric NOT NULL, annual_total numeric NOT NULL, note text, created_by text, created_at timestamp with time zone DEFAULT now() NOT NULL, exchange_rate numeric, deduction numeric);
CREATE TABLE legacy_dashboard.notifications (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, event_type text NOT NULL, actor_id uuid, actor_name text, message text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE legacy_dashboard.branch_studies (id uuid DEFAULT gen_random_uuid() NOT NULL, owner_id uuid NOT NULL, owner_name text DEFAULT ''::text NOT NULL, study jsonb NOT NULL, total numeric DEFAULT 0 NOT NULL, version bigint DEFAULT 1 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE legacy_dashboard.branch_study_members (study_id uuid NOT NULL, user_id uuid NOT NULL, permission text NOT NULL);
CREATE TABLE legacy_dashboard.operations_outbox (id uuid DEFAULT gen_random_uuid() NOT NULL, fingerprint text NOT NULL, report_id uuid, snapshot jsonb NOT NULL, approved_by uuid NOT NULL, approved_at timestamp with time zone DEFAULT now() NOT NULL, delivered_at timestamp with time zone, attempts integer DEFAULT 0 NOT NULL, next_attempt_at timestamp with time zone DEFAULT now() NOT NULL, last_error text, lease_until timestamp with time zone, lease_token uuid);
ALTER TABLE legacy_dashboard."admins" ADD CONSTRAINT "admins_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."admins" ADD CONSTRAINT "admins_user_id_key" UNIQUE (user_id);
ALTER TABLE legacy_dashboard."admins" ADD CONSTRAINT "admins_email_key" UNIQUE (email);
ALTER TABLE legacy_dashboard."app_settings" ADD CONSTRAINT "one_row" CHECK ((id = 1));
ALTER TABLE legacy_dashboard."app_settings" ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."app_secrets" ADD CONSTRAINT "one_row_secret" CHECK ((id = 1));
ALTER TABLE legacy_dashboard."app_secrets" ADD CONSTRAINT "app_secrets_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."reports" ADD CONSTRAINT "reports_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."clinic_schedule" ADD CONSTRAINT "one_schedule" CHECK ((id = 1));
ALTER TABLE legacy_dashboard."clinic_schedule" ADD CONSTRAINT "clinic_schedule_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."tab_access" ADD CONSTRAINT "tab_access_pkey" PRIMARY KEY (admin_id);
ALTER TABLE legacy_dashboard."amida_settings" ADD CONSTRAINT "one_row_amida" CHECK ((id = 1));
ALTER TABLE legacy_dashboard."amida_settings" ADD CONSTRAINT "amida_settings_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."amida_archive" ADD CONSTRAINT "amida_archive_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."usage_log" ADD CONSTRAINT "usage_log_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."branch_studies" ADD CONSTRAINT "branch_studies_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."branch_study_members" ADD CONSTRAINT "branch_study_members_permission_check" CHECK ((permission = ANY (ARRAY['view'::text, 'add'::text, 'edit'::text, 'full'::text])));
ALTER TABLE legacy_dashboard."branch_study_members" ADD CONSTRAINT "branch_study_members_pkey" PRIMARY KEY (study_id, user_id);
ALTER TABLE legacy_dashboard."operations_outbox" ADD CONSTRAINT "operations_outbox_pkey" PRIMARY KEY (id);
ALTER TABLE legacy_dashboard."operations_outbox" ADD CONSTRAINT "operations_outbox_fingerprint_key" UNIQUE (fingerprint);
ALTER TABLE legacy_dashboard."admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE legacy_dashboard."reports" ADD CONSTRAINT "reports_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE legacy_dashboard."clinic_schedule" ADD CONSTRAINT "clinic_schedule_saved_by_fkey" FOREIGN KEY (saved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE legacy_dashboard."tab_access" ADD CONSTRAINT "tab_access_admin_id_fkey" FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;
ALTER TABLE legacy_dashboard."usage_log" ADD CONSTRAINT "usage_log_admin_id_fkey" FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;
ALTER TABLE legacy_dashboard."branch_studies" ADD CONSTRAINT "branch_studies_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE legacy_dashboard."branch_study_members" ADD CONSTRAINT "branch_study_members_study_id_fkey" FOREIGN KEY (study_id) REFERENCES branch_studies(id) ON DELETE CASCADE;
ALTER TABLE legacy_dashboard."branch_study_members" ADD CONSTRAINT "branch_study_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE legacy_dashboard."operations_outbox" ADD CONSTRAINT "operations_outbox_report_id_fkey" FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL;
ALTER TABLE legacy_dashboard."operations_outbox" ADD CONSTRAINT "operations_outbox_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id);
CREATE INDEX admins_email_idx ON legacy_dashboard.admins USING btree (lower(email));
CREATE INDEX reports_created_idx ON legacy_dashboard.reports USING btree (created_at DESC);
CREATE INDEX reports_period_idx ON legacy_dashboard.reports USING btree (period_from, period_to);
CREATE INDEX branch_studies_owner_idx ON legacy_dashboard.branch_studies USING btree (owner_id);
CREATE INDEX branch_members_user_idx ON legacy_dashboard.branch_study_members USING btree (user_id);
CREATE OR REPLACE FUNCTION legacy_dashboard.guard_admin_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard'
AS $function$
begin
  if legacy_dashboard.is_super() then return new; end if;
  if new.role       is distinct from old.role
  or new.active     is distinct from old.active
  or new.ai_enabled is distinct from old.ai_enabled then
    raise exception 'غير مسموح بتغيير الدور أو الحالة أو صلاحية التحليل الذكي';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.get_ai_key()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'legacy_dashboard'
AS $function$
declare k text; shared boolean; mine boolean; ok boolean;
begin
  select active, coalesce(ai_enabled, false)
    into ok, mine
    from legacy_dashboard.admins
   where user_id = auth.uid();

  if not coalesce(ok, false) then return null; end if;

  if not legacy_dashboard.is_super() then
    select coalesce(enable_for_admins, false) into shared
      from legacy_dashboard.app_settings where id = 1;
    if not (coalesce(mine, false) or coalesce(shared, false)) then
      return null;
    end if;
  end if;

  select decrypted_secret into k from vault.decrypted_secrets where name = 'legacy_dashboard_ai_api_key';
  return k;
end $function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.operations_delivery_claim(p_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF operations_outbox
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard'
AS $function$
 update legacy_dashboard.operations_outbox set lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),attempts=attempts+1
 where id in (select id from legacy_dashboard.operations_outbox where delivered_at is null and next_attempt_at<=now()
 and (lease_until is null or lease_until<now()) and (p_id is null or id=p_id) order by approved_at limit 10 for update skip locked) returning *;
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.operations_delivery_finish(p_id uuid, p_lease uuid, p_ok boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard'
AS $function$
 update legacy_dashboard.operations_outbox set delivered_at=case when p_ok then now() else null end,
 last_error=case when p_ok then null else 'تعذر التسليم؛ ستعاد المحاولة' end,
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::integer),lease_until=null,lease_token=null
 where id=p_id and lease_token=p_lease;
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.is_super()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'legacy_dashboard'
AS $function$
  select exists (
    select 1 from legacy_dashboard.admins
    where user_id = auth.uid()
      and active
      and role in ('سوبر أدمن', 'سوبر ادمن', 'مالك')
  );
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.can_access_amida()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select legacy_dashboard.is_super() or exists (
    select 1 from legacy_dashboard.admins a
    join legacy_dashboard.tab_access ta on ta.admin_id = a.id
    where a.user_id = auth.uid() and 'amida' = any(ta.tabs)
  );
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.protect_owner_admin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.email = 'mohamadmh32@gmail.com' and (new.role <> 'سوبر أدمن' or new.active = false) then
    raise exception 'هذا الحساب سوبر أدمن دائم — لا يمكن تغيير دوره أو إيقافه.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.protect_owner_admin_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.email = 'mohamadmh32@gmail.com' then
    raise exception 'هذا الحساب سوبر أدمن دائم — لا يمكن حذفه.';
  end if;
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.branch_block_legacy()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
 if new.payload->>'kind'='branch-study' then
  raise exception 'use branch study functions';
 end if;

 return new;
end
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.branch_permission(sid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard', 'pg_temp'
AS $function$
declare p text;
begin
 if not exists(
  select 1 from admins
  where user_id=auth.uid() and active is not false
 ) then
  return null;
 end if;

 if legacy_dashboard.is_super() then return 'owner'; end if;

 if exists(
  select 1 from branch_studies
  where id=sid and owner_id=auth.uid()
 ) then
  return 'owner';
 end if;

 select permission into p
 from branch_study_members
 where study_id=sid and user_id=auth.uid();

 return p;
end
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.branch_studies_list()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard', 'pg_temp'
AS $function$
 select coalesce(
  jsonb_agg(
   to_jsonb(b)||jsonb_build_object('permission',branch_permission(b.id))
   order by b.updated_at desc
  ),
  '[]'::jsonb
 )
 from branch_studies b
 where branch_permission(b.id) is not null
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.branch_study_valid(doc jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'legacy_dashboard', 'pg_temp'
AS $function$
declare
 s jsonb;
 r jsonb;
 ids text[]='{}';
 rids text[];
begin
 if jsonb_typeof(doc) is distinct from 'object'
 or jsonb_typeof(doc->'id') is distinct from 'string'
 or coalesce(doc->>'id','')=''
 or jsonb_typeof(doc->'name') is distinct from 'string'
 or length(trim(doc->>'name'))=0
 or length(doc->>'name')>160
 or jsonb_typeof(doc->'sections') is distinct from 'array'
 then
  return false;
 end if;

 for s in select value from jsonb_array_elements(doc->'sections') loop
  if jsonb_typeof(s->'id') is distinct from 'string'
  or coalesce(s->>'id','')=''
  or s->>'id'=any(ids)
  or jsonb_typeof(s->'name') is distinct from 'string'
  or jsonb_typeof(s->'items') is distinct from 'array'
  then
   return false;
  end if;

  ids=array_append(ids,s->>'id');
  rids='{}';

  for r in select value from jsonb_array_elements(s->'items') loop
   if jsonb_typeof(r->'id') is distinct from 'string'
   or coalesce(r->>'id','')=''
   or r->>'id'=any(rids)
   or jsonb_typeof(r->'name') is distinct from 'string'
   or jsonb_typeof(r->'qty') is distinct from 'number'
   or jsonb_typeof(r->'unit') is distinct from 'number'
   then
    return false;
   end if;

   if (r->>'qty')::numeric<0 or (r->>'unit')::numeric<0 then
    return false;
   end if;

   rids=array_append(rids,r->>'id');
  end loop;
 end loop;

 return true;
exception when others then
 return false;
end
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.branch_change_allowed(old_doc jsonb, new_doc jsonb, p text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'legacy_dashboard', 'pg_temp'
AS $function$
declare
 s jsonb;
 ns jsonb;
 r jsonb;
 nr jsonb;
begin
 if p in ('owner','full') then return true; end if;
 if p not in ('add','edit') or p is null then return false; end if;

 if old_doc->>'id' is distinct from new_doc->>'id' then
  return false;
 end if;

 if p='add'
 and old_doc->>'name' is distinct from new_doc->>'name'
 then
  return false;
 end if;

 if p='edit'
 and jsonb_array_length(old_doc->'sections')
 <>jsonb_array_length(new_doc->'sections')
 then
  return false;
 end if;

 for s in select value from jsonb_array_elements(old_doc->'sections') loop
  select value into ns
  from jsonb_array_elements(new_doc->'sections')
  where value->>'id'=s->>'id';

  if ns is null then return false; end if;

  if p='add' and s->>'name' is distinct from ns->>'name' then
   return false;
  end if;

  if p='edit'
  and jsonb_array_length(s->'items')<>jsonb_array_length(ns->'items')
  then
   return false;
  end if;

  for r in select value from jsonb_array_elements(s->'items') loop
   select value into nr
   from jsonb_array_elements(ns->'items')
   where value->>'id'=r->>'id';

   if nr is null then return false; end if;

   if p='add' and (
    r->>'name' is distinct from nr->>'name'
    or r->'qty' is distinct from nr->'qty'
    or r->'unit' is distinct from nr->'unit'
   ) then
    return false;
   end if;
  end loop;
 end loop;

 return true;
end
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.branch_study_save(sid uuid, doc jsonb, expected_version bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard', 'pg_temp'
AS $function$
declare
 b branch_studies;
 p text;
 clean jsonb;
 cost numeric;
 profile admins;
begin
 select * into profile
 from admins
 where user_id=auth.uid() and active is not false;

 if profile is null then raise exception 'permission denied'; end if;
 if not branch_study_valid(doc) then raise exception 'invalid study'; end if;

 clean=jsonb_build_object(
  'id',doc->>'id',
  'name',trim(doc->>'name'),
  'sections',doc->'sections'
 );

 select coalesce(sum((r->>'qty')::numeric*(r->>'unit')::numeric),0)
 into cost
 from jsonb_array_elements(clean->'sections') s
 cross join lateral jsonb_array_elements(s->'items') r;

 if sid is null then
  if not legacy_dashboard.is_super() and profile.role not in ('مدير','محاسب') then
   raise exception 'permission denied';
  end if;

  insert into branch_studies(owner_id,owner_name,study,total)
  values(
   auth.uid(),
   coalesce(profile.name,profile.email,''),
   clean,
   cost
  )
  returning * into b;
 else
  select * into b from branch_studies where id=sid for update;

  if not found then raise exception 'study unavailable'; end if;

  p=branch_permission(sid);

  if not branch_change_allowed(b.study,clean,p) then
   raise exception 'permission denied';
  end if;

  if expected_version is null or expected_version<>b.version then
   raise exception 'version conflict';
  end if;

  update branch_studies
  set study=clean,total=cost,version=version+1,updated_at=now()
  where id=sid
  returning * into b;
 end if;

 return to_jsonb(b)
 ||jsonb_build_object('permission',branch_permission(b.id));
end
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.branch_study_delete(sid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard', 'pg_temp'
AS $function$
begin
 if branch_permission(sid) is distinct from 'owner' then
  raise exception 'permission denied';
 end if;

 delete from branch_studies where id=sid;
 return found;
end
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.branch_study_users(sid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard', 'pg_temp'
AS $function$
begin
 if branch_permission(sid) is distinct from 'owner' then
  raise exception 'permission denied';
 end if;

 return (
  select coalesce(
   jsonb_agg(
    jsonb_build_object(
     'user_id',a.user_id,
     'name',a.name,
     'email',a.email,
     'permission',m.permission
    )
    order by a.name
   ),
   '[]'::jsonb
  )
  from admins a
  left join branch_study_members m
  on m.user_id=a.user_id and m.study_id=sid
  where a.active is not false
  and a.user_id is not null
  and a.user_id<>(select owner_id from branch_studies where id=sid)
 );
end
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.branch_study_share(sid uuid, uid uuid, p text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard', 'pg_temp'
AS $function$
begin
 if branch_permission(sid) is distinct from 'owner' then
  raise exception 'permission denied';
 end if;

 if not exists(
  select 1 from admins where user_id=uid and active is not false
 ) then
  raise exception 'user unavailable';
 end if;

 if p is null then
  delete from branch_study_members
  where study_id=sid and user_id=uid;
 else
  if p not in ('view','add','edit','full') then
   raise exception 'invalid permission';
  end if;

  insert into branch_study_members(study_id,user_id,permission)
  values(sid,uid,p)
  on conflict(study_id,user_id)
  do update set permission=excluded.permission;
 end if;

 return true;
end
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.operations_export_items(p_items jsonb, p_kind text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'legacy_dashboard'
AS $function$
 select coalesce(jsonb_agg(item),'[]') from (
 select coalesce(jsonb_object_agg(k,v),'{}') item from jsonb_array_elements(coalesce(p_items,'[]')) with ordinality a(value,ord)
 cross join lateral jsonb_each(a.value) b(k,v)
 where k=any(case p_kind when 'risks' then array['id','title','area','sev','finding','metric','value','target','impact']
 when 'recommendations' then array['riskId','title','area','steps'] else array['t','own','wk','kpi','tgt','pr','area','riskId','sev','why','risk','metric','value','target','impact','steps'] end)
 and (jsonb_typeof(v) in ('string','number','null') or (k='steps' and jsonb_typeof(v)='array' and not exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x)<>'string')))
 group by ord order by ord) items;
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.operations_server_secrets()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select pg_catalog.jsonb_build_object(
  'bridge',(select decrypted_secret from vault.decrypted_secrets where name='legacy_dashboard_operations_bridge_secret' limit 1),
  'cron',(select decrypted_secret from vault.decrypted_secrets where name='legacy_dashboard_operations_cron_secret' limit 1));
$function$;

CREATE OR REPLACE FUNCTION legacy_dashboard.operations_enqueue(p_report_id uuid, p_branch text, p_scope text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'legacy_dashboard'
AS $function$
declare r legacy_dashboard.reports%rowtype; s jsonb; core jsonb; fp text; result legacy_dashboard.operations_outbox%rowtype;
begin
 if not legacy_dashboard.is_super() and not exists(select 1 from legacy_dashboard.admins where user_id=auth.uid() and active and role='مدير') then raise exception 'اعتماد الإرسال متاح للإدارة فقط'; end if;
 if length(trim(p_branch)) not between 2 and 120 or length(trim(p_scope)) not between 2 and 120 then raise exception 'حدد الفرع ونطاق التقرير'; end if;
 select * into r from legacy_dashboard.reports where id=p_report_id;
 if not found or r.period_from is null or r.period_to is null or r.period_to<r.period_from or coalesce(r.payload->>'kind','') in ('branch-study','comparison') then raise exception 'اختر تحليل فترة محددة'; end if;
 -- No rows, filenames, patients, identities, diagnoses or contact details enter the bridge.
 select jsonb_build_object('schema_version',1,'branch',trim(p_branch),'scope',trim(p_scope),
  'period_from',r.period_from,'period_to',r.period_to,
  'coverage',(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(coalesce(r.payload->'coverage','{}')) where jsonb_typeof(value)='boolean'),
  'coverage_notice',left(coalesce(r.payload->>'coverageNotice','تغطية البيانات غير مسجلة في هذا التقرير'),1000),
  'kpis',(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(r.payload->'kpi') where jsonb_typeof(value)='number'),
  'risks',legacy_dashboard.operations_export_items(r.payload#>'{evaluation,risks}','risks'),
  'recommendations',legacy_dashboard.operations_export_items(r.payload#>'{evaluation,recos}','recommendations'),
  'plan',legacy_dashboard.operations_export_items(r.payload#>'{evaluation,plan}','plan')) into core;
 if jsonb_array_length(core->'risks')>200 or jsonb_array_length(core->'plan')>300 or length(core::text)>300000 then raise exception 'التقرير يتجاوز حد الإرسال'; end if;
 fp:=encode(extensions.digest(core::text,'sha256'),'hex');
 s:=core||jsonb_build_object('fingerprint',fp,'title',left(r.title,160));
 insert into legacy_dashboard.operations_outbox(fingerprint,report_id,snapshot,approved_by) values(fp,r.id,s,auth.uid()) on conflict(fingerprint) do nothing;
 select * into result from legacy_dashboard.operations_outbox where fingerprint=fp;
 return jsonb_build_object('id',result.id,'delivered',result.delivered_at is not null,'fingerprint',fp);
end $function$;

ALTER TABLE legacy_dashboard."app_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."app_secrets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."clinic_schedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."tab_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."usage_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."amida_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."amida_archive" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."branch_studies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."branch_study_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_dashboard."operations_outbox" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read settings" ON legacy_dashboard."app_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "super writes settings" ON legacy_dashboard."app_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_super()) WITH CHECK (is_super());
CREATE POLICY "super only secrets" ON legacy_dashboard."app_secrets" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_super()) WITH CHECK (is_super());
CREATE POLICY "claim own invite" ON legacy_dashboard."admins" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id IS NULL) AND (lower(email) = lower((auth.jwt() ->> 'email'::text))))) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "read own or pending" ON legacy_dashboard."admins" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR ((user_id IS NULL) AND (lower(email) = lower((auth.jwt() ->> 'email'::text))))));
CREATE POLICY "super reads all" ON legacy_dashboard."admins" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_super());
CREATE POLICY "super writes all" ON legacy_dashboard."admins" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_super()) WITH CHECK (is_super());
CREATE POLICY "active read reports" ON legacy_dashboard."reports" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND admins.active))));
CREATE POLICY "owner deletes reports" ON legacy_dashboard."reports" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((created_by = auth.uid()) OR is_super()));
CREATE POLICY "uploaders add reports" ON legacy_dashboard."reports" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND admins.active AND (admins.role = ANY (ARRAY['سوبر أدمن'::text, 'سوبر ادمن'::text, 'مالك'::text, 'مدير'::text, 'محاسب'::text]))))));
CREATE POLICY "all read schedule" ON legacy_dashboard."clinic_schedule" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND admins.active))));
CREATE POLICY "super writes schedule" ON legacy_dashboard."clinic_schedule" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_super()) WITH CHECK (is_super());
CREATE POLICY "read own tab access" ON legacy_dashboard."tab_access" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((admin_id IN ( SELECT admins.id
   FROM admins
  WHERE (admins.user_id = auth.uid()))) OR is_super()));
CREATE POLICY "super writes tab access" ON legacy_dashboard."tab_access" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_super()) WITH CHECK (is_super());
CREATE POLICY "usage insert own" ON legacy_dashboard."usage_log" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((admin_id = ( SELECT admins.id
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "usage select super" ON legacy_dashboard."usage_log" AS PERMISSIVE FOR SELECT TO "public" USING (is_super());
CREATE POLICY "usage update own" ON legacy_dashboard."usage_log" AS PERMISSIVE FOR UPDATE TO "public" USING ((admin_id = ( SELECT admins.id
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
CREATE POLICY "amida granted read settings" ON legacy_dashboard."amida_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (can_access_amida());
CREATE POLICY "amida granted write settings" ON legacy_dashboard."amida_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (can_access_amida()) WITH CHECK (can_access_amida());
CREATE POLICY "amida granted read archive" ON legacy_dashboard."amida_archive" AS PERMISSIVE FOR SELECT TO "authenticated" USING (can_access_amida());
CREATE POLICY "amida granted write archive" ON legacy_dashboard."amida_archive" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (can_access_amida());
CREATE POLICY "amida super delete archive" ON legacy_dashboard."amida_archive" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_super());
CREATE POLICY "amida super update archive" ON legacy_dashboard."amida_archive" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_super()) WITH CHECK (is_super());
CREATE POLICY "notif delete admin manager" ON legacy_dashboard."notifications" AS PERMISSIVE FOR DELETE TO "public" USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.active = true) AND (admins.role = ANY (ARRAY['سوبر أدمن'::text, 'مدير'::text]))))));
CREATE POLICY "notif insert any admin" ON legacy_dashboard."notifications" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.active = true)))));
CREATE POLICY "notif select admin manager" ON legacy_dashboard."notifications" AS PERMISSIVE FOR SELECT TO "public" USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = auth.uid()) AND (admins.active = true) AND (admins.role = ANY (ARRAY['سوبر أدمن'::text, 'مدير'::text]))))));
CREATE POLICY "operations_outbox_read" ON legacy_dashboard."operations_outbox" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_super() OR (approved_by = auth.uid())));
CREATE TRIGGER admins_guard BEFORE UPDATE ON legacy_dashboard.admins FOR EACH ROW EXECUTE FUNCTION guard_admin_changes();
CREATE TRIGGER trg_protect_owner_admin BEFORE UPDATE ON legacy_dashboard.admins FOR EACH ROW EXECUTE FUNCTION protect_owner_admin();
CREATE TRIGGER trg_protect_owner_admin_delete BEFORE DELETE ON legacy_dashboard.admins FOR EACH ROW EXECUTE FUNCTION protect_owner_admin_delete();
CREATE TRIGGER branch_block_legacy BEFORE INSERT OR UPDATE ON legacy_dashboard.reports FOR EACH ROW EXECUTE FUNCTION branch_block_legacy();
ALTER FUNCTION legacy_dashboard.can_access_amida() SET search_path=legacy_dashboard,pg_temp;
ALTER FUNCTION legacy_dashboard.protect_owner_admin() SET search_path=legacy_dashboard,pg_temp;
ALTER FUNCTION legacy_dashboard.protect_owner_admin_delete() SET search_path=legacy_dashboard,pg_temp;
ALTER FUNCTION legacy_dashboard.branch_block_legacy() SET search_path=legacy_dashboard,pg_temp;
DO $acl$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='legacy_dashboard'
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',f.signature); END LOOP;
END $acl$;
COMMIT;
