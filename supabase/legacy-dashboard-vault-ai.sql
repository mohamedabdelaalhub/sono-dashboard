BEGIN;
CREATE TABLE legacy_dashboard.ai_request_limits (
user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
bucket timestamptz NOT NULL,
count integer NOT NULL DEFAULT 1,
PRIMARY KEY(user_id,bucket)
);
ALTER TABLE legacy_dashboard.ai_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_dashboard.ai_request_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON legacy_dashboard.ai_request_limits TO service_role;
CREATE FUNCTION legacy_dashboard.set_ai_key(new_key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
DECLARE k text := nullif(trim(new_key),''); sid uuid;
BEGIN
IF NOT legacy_dashboard.is_super() THEN RAISE EXCEPTION 'permission denied'; END IF;
SELECT id INTO sid FROM vault.secrets WHERE name='legacy_dashboard_ai_api_key';
IF k IS NULL THEN
 DELETE FROM vault.secrets WHERE name='legacy_dashboard_ai_api_key';
ELSIF sid IS NULL THEN
 PERFORM vault.create_secret(k,'legacy_dashboard_ai_api_key','AI key for isolated legacy dashboard');
ELSE
 PERFORM vault.update_secret(sid,k);
END IF;
UPDATE legacy_dashboard.app_settings SET has_key=(k IS NOT NULL), updated_at=now() WHERE id=1;
RETURN true;
END $body$;
REVOKE ALL ON FUNCTION legacy_dashboard.set_ai_key(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION legacy_dashboard.set_ai_key(text) TO authenticated;
CREATE FUNCTION legacy_dashboard.dashboard_ai_server_key() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='legacy_dashboard_ai_api_key'
$body$;
REVOKE ALL ON FUNCTION legacy_dashboard.dashboard_ai_server_key() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION legacy_dashboard.dashboard_ai_server_key() TO service_role;
CREATE FUNCTION legacy_dashboard.consume_ai_request(uid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE used integer;
BEGIN
INSERT INTO legacy_dashboard.ai_request_limits(user_id,bucket) VALUES(uid,date_trunc('minute',now()))
ON CONFLICT(user_id,bucket) DO UPDATE SET count=ai_request_limits.count+1 RETURNING count INTO used;
DELETE FROM legacy_dashboard.ai_request_limits WHERE bucket<now()-interval '1 day';
RETURN used<=5;
END $body$;
REVOKE ALL ON FUNCTION legacy_dashboard.consume_ai_request(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION legacy_dashboard.consume_ai_request(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
