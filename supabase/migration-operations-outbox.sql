-- Approved, aggregate-only report deliveries. Apply after migration-reports.sql.
create extension if not exists pgcrypto;
create table if not exists public.operations_outbox (
 id uuid primary key default gen_random_uuid(), fingerprint text not null unique,
 report_id uuid references public.reports(id) on delete set null,
 snapshot jsonb not null, approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(), delivered_at timestamptz,
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 last_error text, lease_until timestamptz, lease_token uuid
);
alter table public.operations_outbox enable row level security;
revoke all on public.operations_outbox from anon, authenticated;
grant select on public.operations_outbox to authenticated;
drop policy if exists operations_outbox_read on public.operations_outbox;
create policy operations_outbox_read on public.operations_outbox for select to authenticated using (
 public.is_super() or approved_by=auth.uid());
-- Keep only the documented risk/recommendation/action fields, never arbitrary nested rows.
create or replace function public.operations_export_items(p_items jsonb,p_kind text) returns jsonb language sql immutable set search_path=public as $$
 select coalesce(jsonb_agg(item),'[]') from (
 select coalesce(jsonb_object_agg(k,v),'{}') item from jsonb_array_elements(coalesce(p_items,'[]')) with ordinality a(value,ord)
 cross join lateral jsonb_each(a.value) b(k,v)
 where k=any(case p_kind when 'risks' then array['id','title','area','sev','finding','metric','value','target','impact']
 when 'recommendations' then array['riskId','title','area','steps'] else array['t','own','wk','kpi','tgt','pr','area','riskId','sev','why','risk','metric','value','target','impact','steps'] end)
 and (jsonb_typeof(v) in ('string','number','null') or (k='steps' and jsonb_typeof(v)='array' and not exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x)<>'string')))
 group by ord order by ord) items;
$$;
revoke all on function public.operations_export_items(jsonb,text) from public,anon,authenticated;
create or replace function public.operations_enqueue(p_report_id uuid,p_branch text,p_scope text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.reports%rowtype; s jsonb; core jsonb; fp text; result public.operations_outbox%rowtype;
begin
 if not public.is_super() and not exists(select 1 from public.admins where user_id=auth.uid() and active and role='مدير') then raise exception 'اعتماد الإرسال متاح للإدارة فقط'; end if;
 if length(trim(p_branch)) not between 2 and 120 or length(trim(p_scope)) not between 2 and 120 then raise exception 'حدد الفرع ونطاق التقرير'; end if;
 select * into r from public.reports where id=p_report_id;
 if not found or r.period_from is null or r.period_to is null or r.period_to<r.period_from or coalesce(r.payload->>'kind','') in ('branch-study','comparison') then raise exception 'اختر تحليل فترة محددة'; end if;
 -- No rows, filenames, patients, identities, diagnoses or contact details enter the bridge.
 select jsonb_build_object('schema_version',1,'branch',trim(p_branch),'scope',trim(p_scope),
  'period_from',r.period_from,'period_to',r.period_to,
  'coverage',(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(coalesce(r.payload->'coverage','{}')) where jsonb_typeof(value)='boolean'),
  'coverage_notice',left(coalesce(r.payload->>'coverageNotice','تغطية البيانات غير مسجلة في هذا التقرير'),1000),
  'kpis',(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(r.payload->'kpi') where jsonb_typeof(value)='number'),
  'risks',public.operations_export_items(r.payload#>'{evaluation,risks}','risks'),
  'recommendations',public.operations_export_items(r.payload#>'{evaluation,recos}','recommendations'),
  'plan',public.operations_export_items(r.payload#>'{evaluation,plan}','plan')) into core;
 if jsonb_array_length(core->'risks')>200 or jsonb_array_length(core->'plan')>300 or length(core::text)>300000 then raise exception 'التقرير يتجاوز حد الإرسال'; end if;
 fp:=encode(digest(core::text,'sha256'),'hex');
 s:=core||jsonb_build_object('fingerprint',fp,'title',left(r.title,160));
 insert into public.operations_outbox(fingerprint,report_id,snapshot,approved_by) values(fp,r.id,s,auth.uid()) on conflict(fingerprint) do nothing;
 select * into result from public.operations_outbox where fingerprint=fp;
 return jsonb_build_object('id',result.id,'delivered',result.delivered_at is not null,'fingerprint',fp);
end $$;
revoke all on function public.operations_enqueue(uuid,text,text) from public;
grant execute on function public.operations_enqueue(uuid,text,text) to authenticated;
-- Claims use fencing so an expired worker cannot overwrite a newer retry.
create or replace function public.operations_delivery_claim(p_id uuid default null)
returns setof public.operations_outbox language sql security definer set search_path=public as $$
 update public.operations_outbox set lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),attempts=attempts+1
 where id in (select id from public.operations_outbox where delivered_at is null and next_attempt_at<=now()
 and (lease_until is null or lease_until<now()) and (p_id is null or id=p_id) order by approved_at limit 10 for update skip locked) returning *;
$$;
create or replace function public.operations_delivery_finish(p_id uuid,p_lease uuid,p_ok boolean)
returns void language sql security definer set search_path=public as $$
 update public.operations_outbox set delivered_at=case when p_ok then now() else null end,
 last_error=case when p_ok then null else 'تعذر التسليم؛ ستعاد المحاولة' end,
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::integer),lease_until=null,lease_token=null
 where id=p_id and lease_token=p_lease;
$$;
revoke all on function public.operations_delivery_claim(uuid) from public,anon,authenticated;
revoke all on function public.operations_delivery_finish(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.operations_delivery_claim(uuid), public.operations_delivery_finish(uuid,uuid,boolean) to service_role;
