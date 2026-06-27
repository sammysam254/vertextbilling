-- ================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================================

-- Improved checkin_router with NULL guards and better session handling
CREATE OR REPLACE FUNCTION checkin_router(router_id TEXT)
RETURNS TEXT AS $$
DECLARE
  router_uuid UUID;
  sess RECORD;
  plan_rec RECORD;
  commands TEXT := '';
  username TEXT;
  password TEXT;
  session_timeout TEXT;
  mac_clean TEXT;
BEGIN
  BEGIN
    router_uuid := router_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN '# Error: Invalid router ID format (' || COALESCE(router_id, 'null') || ')';
  END;

  UPDATE mikrotik_configs SET last_seen = NOW() WHERE id = router_uuid;

  IF NOT FOUND THEN
    RETURN '# Error: Router ID not found in database.';
  END IF;

  FOR sess IN 
    SELECT s.*, c.user_id as owner_id 
    FROM hotspot_sessions s
    JOIN mikrotik_configs c ON c.id = router_uuid
    WHERE s.status = 'pending' 
      AND s.user_id = c.user_id
      AND s.mac_address IS NOT NULL
      AND s.mac_address != ''
  LOOP
    SELECT * INTO plan_rec FROM plans WHERE id = sess.plan_id;
    IF plan_rec IS NULL THEN CONTINUE; END IF;
    
    mac_clean := lower(replace(COALESCE(sess.mac_address, '000000000000'), ':', ''));
    username := 'hs_' || substring(mac_clean from 1 for 12);
    password := substring(md5(random()::text || sess.id::text) from 1 for 8);
    session_timeout := COALESCE(plan_rec.duration_hours, 24) || 'h';

    commands := commands || 
      '/ip hotspot user remove [find where name="' || username || '"];' || CHR(10) ||
      '/ip hotspot user add name="' || username || '" password="' || password || '" profile="' || COALESCE(plan_rec.name, 'default') || '" limit-uptime=' || session_timeout || ' comment="Vertex ' || sess.id::text || '";' || CHR(10) ||
      ':delay 500ms;' || CHR(10) ||
      '/ip hotspot active login user="' || username || '" password="' || password || '" ip="' || COALESCE(sess.ip_address, '') || '" mac-address="' || COALESCE(sess.mac_address, '') || '";' || CHR(10) || CHR(10);

    UPDATE hotspot_sessions SET status = 'active', mikrotik_user = username WHERE id = sess.id;
    UPDATE payments SET status = 'confirmed' WHERE customer_id = sess.customer_id AND status = 'pending' AND created_at >= (NOW() - INTERVAL '2 hours');
  END LOOP;

  IF commands = '' THEN
    RETURN '# Heartbeat OK';
  END IF;
  RETURN commands;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION checkin_router(TEXT) TO anon, authenticated;

-- Allow public read of sessions for captive portal polling
DROP POLICY IF EXISTS "sessions_public_read" ON hotspot_sessions;
CREATE POLICY "sessions_public_read" ON hotspot_sessions FOR SELECT USING (TRUE);

-- Allow public read of payments for captive portal  
DROP POLICY IF EXISTS "payments_public_read" ON payments;
CREATE POLICY "payments_public_read" ON payments FOR SELECT USING (TRUE);

-- Allow anon to update last_seen on mikrotik_configs (for heartbeat fallback)
DROP POLICY IF EXISTS "mikrotik_heartbeat" ON mikrotik_configs;
CREATE POLICY "mikrotik_heartbeat" ON mikrotik_configs 
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- Allow anon to SELECT mikrotik_configs (needed by edge function)
DROP POLICY IF EXISTS "mikrotik_public_read" ON mikrotik_configs;
CREATE POLICY "mikrotik_public_read" ON mikrotik_configs 
  FOR SELECT USING (TRUE);
