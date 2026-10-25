BEGIN;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'email',email,'role','authenticated')::text,true) FROM legacy_dashboard.admins WHERE email='mohamadmh32@gmail.com';
SET LOCAL ROLE authenticated;
DO $test$
DECLARE s jsonb; r uuid; changed integer;
BEGIN
IF NOT legacy_dashboard.is_super() THEN RAISE EXCEPTION 'owner mapping failed'; END IF;
s:=legacy_dashboard.branch_study_save(NULL,'{"id":"migration-verification","name":"Migration verification","sections":[{"id":"section","name":"Section","items":[{"id":"item","name":"Item","qty":2,"unit":100}]}]}'::jsonb,NULL);
IF (s->>'total')::numeric<>200 THEN RAISE EXCEPTION 'study total failed'; END IF;
s:=legacy_dashboard.branch_study_save((s->>'id')::uuid,s->'study',(s->>'version')::bigint);
PERFORM legacy_dashboard.branch_study_users((s->>'id')::uuid);
PERFORM legacy_dashboard.branch_study_delete((s->>'id')::uuid);
INSERT INTO legacy_dashboard.reports(title,payload,created_by) VALUES('Migration verification','{"kpi":{}}',auth.uid()) RETURNING id INTO r;
DELETE FROM legacy_dashboard.reports WHERE id=r;
INSERT INTO legacy_dashboard.clinic_schedule(id,payload,saved_by) VALUES(1,'{"migration_verification":true}',auth.uid()) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload;
UPDATE legacy_dashboard.amida_settings SET exchange_rate=exchange_rate WHERE id=1;
GET DIAGNOSTICS changed=ROW_COUNT;
IF changed<>1 THEN RAISE EXCEPTION 'amida update failed'; END IF;
INSERT INTO legacy_dashboard.notifications(event_type,actor_id,message) VALUES('migration-verification',auth.uid(),'Migration verification');
BEGIN
 UPDATE legacy_dashboard.admins SET role='مستخدم' WHERE email='mohamadmh32@gmail.com';
 RAISE EXCEPTION 'owner protection failed';
EXCEPTION WHEN raise_exception THEN
 IF SQLERRM='owner protection failed' THEN RAISE; END IF;
END;
END $test$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $test$
DECLARE used boolean; i integer;
BEGIN
IF coalesce(length(legacy_dashboard.dashboard_ai_server_key()),0)=0 THEN RAISE EXCEPTION 'AI Vault key missing'; END IF;
FOR i IN 1..6 LOOP
 used:=legacy_dashboard.consume_ai_request((SELECT user_id FROM legacy_dashboard.admins WHERE email='mohamadmh32@gmail.com'));
 IF used<>(i<=5) THEN RAISE EXCEPTION 'AI rate limit failed'; END IF;
END LOOP;
PERFORM legacy_dashboard.operations_delivery_claim(NULL);
END $test$;
SELECT 'PASS rollback-only study/report/schedule/amida/notification writes, owner protection, Vault lookup, rate limit and queue claim' AS validation;
ROLLBACK;
