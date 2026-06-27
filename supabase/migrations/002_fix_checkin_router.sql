-- ================================================================
-- Migration 002: Fix checkin_router and add anon read for mikrotik
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================================

-- Allow anon to read mikrotik_configs (needed by SECURITY DEFINER function)
-- The function itself runs as postgres, but the SELECT inside needs the table to exist
-- SECURITY DEFINER bypasses RLS, so no extra policy is needed here.
-- However, we do need to ensure the function handles NULL mac_address gracefully.

-- ─── IMPROVED CHECKIN ROUTER RPC ──────────────────────────────────────────
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
  -- Safe casting to UUID to prevent crashes if a placeholder is sent
  BEGIN
    router_uuid := router_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN '# Error: Invalid router ID format (' || COALESCE(router_id, 'null') || '). Ensure your script is configured with a valid UUID from the Vertex Billing dashboard.';
  END;

  -- 1. Update heartbeat timestamp
  UPDATE mikrotik_configs
  SET last_seen = NOW()
  WHERE id = router_uuid;

  -- If no rows updated, the router ID doesn't exist
  IF NOT FOUND THEN
    RETURN '# Error: Router ID not found in database. Check your Vertex Billing dashboard MikroTik config.';
  END IF;

  -- 2. Find ALL pending sessions for this router's owner (multi-user safe)
  FOR sess IN 
    SELECT s.*, c.user_id as owner_id 
    FROM hotspot_sessions s
    JOIN mikrotik_configs c ON c.id = router_uuid
    WHERE s.status = 'pending' 
      AND s.user_id = c.user_id
      AND s.mac_address IS NOT NULL
      AND s.mac_address != ''
  LOOP
    -- Fetch plan details
    SELECT * INTO plan_rec FROM plans WHERE id = sess.plan_id;
    
    -- Skip if plan not found
    IF plan_rec IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Generate unique credentials from MAC address
    mac_clean := lower(replace(COALESCE(sess.mac_address, '000000000000'), ':', ''));
    username := 'hs_' || substring(mac_clean from 1 for 12);
    password := substring(md5(random()::text || sess.id::text) from 1 for 8);
    session_timeout := COALESCE(plan_rec.duration_hours, 24) || 'h';

    -- Build RouterOS commands to add and log in user
    commands := commands || 
      '# Session: ' || sess.id::text || CHR(10) ||
      '/ip hotspot user remove [find where name="' || username || '"];' || CHR(10) ||
      '/ip hotspot user add name="' || username || '" password="' || password || '" profile="' || COALESCE(plan_rec.name, 'default') || '" limit-uptime=' || session_timeout || ' comment="Vertex ' || sess.id::text || '";' || CHR(10) ||
      ':delay 500ms;' || CHR(10) ||
      '/ip hotspot active login user="' || username || '" password="' || password || '" ip="' || COALESCE(sess.ip_address, '') || '" mac-address="' || COALESCE(sess.mac_address, '') || '";' || CHR(10) ||
      CHR(10);

    -- Mark session as active in DB immediately
    UPDATE hotspot_sessions 
    SET status = 'active', mikrotik_user = username 
    WHERE id = sess.id;

    -- Confirm the matching pending payment
    UPDATE payments
    SET status = 'confirmed'
    WHERE customer_id = sess.customer_id 
      AND status = 'pending'
      AND created_at >= (NOW() - INTERVAL '2 hours');

  END LOOP;

  -- Return empty script (just a comment) if no pending sessions
  IF commands = '' THEN
    RETURN '# Heartbeat OK - no pending sessions';
  END IF;

  RETURN commands;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure anon and authenticated can call it
GRANT EXECUTE ON FUNCTION checkin_router(TEXT) TO anon, authenticated;

-- ─── FIX: Allow public read of hotspot_sessions for portal polling ──────────
-- The captive portal polls session status without auth
DROP POLICY IF EXISTS "sessions_public_read" ON hotspot_sessions;
CREATE POLICY "sessions_public_read" ON hotspot_sessions 
  FOR SELECT USING (TRUE);

-- ─── FIX: Allow public read of payments for portal polling ──────────────────
DROP POLICY IF EXISTS "payments_public_read" ON payments;
CREATE POLICY "payments_public_read" ON payments
  FOR SELECT USING (TRUE);
