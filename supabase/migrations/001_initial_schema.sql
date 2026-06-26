-- ================================================================
-- Vertex Billing System – Supabase Database Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PLANS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  description       TEXT,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_hours    INTEGER NOT NULL DEFAULT 24,
  speed_up_kbps     INTEGER,           -- null = unlimited
  speed_down_kbps   INTEGER,           -- null = unlimited
  data_cap_mb       INTEGER,           -- null = unlimited
  type              TEXT NOT NULL DEFAULT 'hotspot' CHECK (type IN ('hotspot','pppoe')),
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CUSTOMERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  plan_id       UUID REFERENCES plans(id) ON DELETE SET NULL,
  mac_address   TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','expiring','suspended')),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── HOTSPOT SESSIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotspot_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  plan_id       UUID REFERENCES plans(id) ON DELETE SET NULL,
  mac_address   TEXT,
  ip_address    TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','disconnected')),
  mikrotik_user TEXT,   -- username on the MikroTik hotspot
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PAYMENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  plan_id       UUID REFERENCES plans(id) ON DELETE SET NULL,
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  method        TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','mpesa','bank','card','voucher')),
  reference     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed')),
  mpesa_receipt TEXT,
  session_id    UUID REFERENCES hotspot_sessions(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── VOUCHERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id     UUID REFERENCES plans(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,
  used_by     UUID REFERENCES customers(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── COUPONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  discount_type   TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value  NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses        INTEGER NOT NULL DEFAULT 1,
  used_count      INTEGER NOT NULL DEFAULT 0,
  description     TEXT,
  expires_at      TIMESTAMPTZ,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MIKROTIK CONFIGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mikrotik_configs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL DEFAULT 'Main Router',
  host        TEXT NOT NULL,
  port        INTEGER NOT NULL DEFAULT 8728,
  username    TEXT NOT NULL DEFAULT 'billing-api',
  password    TEXT NOT NULL,
  api_port    INTEGER NOT NULL DEFAULT 8728,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── NOTIFICATIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','error','success')),
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  link        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_phone       ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_mac         ON customers(mac_address);
CREATE INDEX IF NOT EXISTS idx_customers_status      ON customers(status);
CREATE INDEX IF NOT EXISTS idx_sessions_mac          ON hotspot_sessions(mac_address);
CREATE INDEX IF NOT EXISTS idx_sessions_status       ON hotspot_sessions(status);
CREATE INDEX IF NOT EXISTS idx_payments_status       ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created      ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_code         ON vouchers(code);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspot_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mikrotik_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;

-- Plans: public read (for captive portal), admin write
CREATE POLICY "plans_public_read"  ON plans FOR SELECT USING (TRUE);
CREATE POLICY "plans_admin_all"    ON plans FOR ALL USING (auth.role() = 'authenticated');

-- Sessions: public insert (portal creates them), admin read/update
CREATE POLICY "sessions_public_insert" ON hotspot_sessions FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "sessions_public_read"   ON hotspot_sessions FOR SELECT USING (TRUE);
CREATE POLICY "sessions_admin_update"  ON hotspot_sessions FOR UPDATE USING (auth.role() = 'authenticated');

-- Payments: public insert (portal creates payments), admin all
CREATE POLICY "payments_public_insert" ON payments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "payments_admin_read"    ON payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "payments_admin_update"  ON payments FOR UPDATE USING (auth.role() = 'authenticated');

-- Customers: public insert + select (for phone lookup), admin all
CREATE POLICY "customers_public_insert" ON customers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "customers_public_select" ON customers FOR SELECT USING (TRUE);
CREATE POLICY "customers_admin_all"     ON customers FOR ALL USING (auth.role() = 'authenticated');

-- Vouchers: admin only
CREATE POLICY "vouchers_admin_all"  ON vouchers FOR ALL USING (auth.role() = 'authenticated');

-- Coupons: admin only
CREATE POLICY "coupons_admin_all"   ON coupons FOR ALL USING (auth.role() = 'authenticated');

-- MikroTik configs: admin only
CREATE POLICY "mikrotik_admin_all"  ON mikrotik_configs FOR ALL USING (auth.role() = 'authenticated');

-- Notifications: admin only
CREATE POLICY "notifs_admin_all"    ON notifications FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "notifs_admin_insert" ON notifications FOR INSERT WITH CHECK (TRUE);

-- ─── SEED: Sample plans ─────────────────────────────────────────
INSERT INTO plans (name, description, price, duration_hours, speed_up_kbps, speed_down_kbps, data_cap_mb, type)
VALUES
  ('1 Hour',   '1 hour internet access',    20,   1,   1024, 2048,  NULL, 'hotspot'),
  ('Daily',    '24 hour internet access',   50,   24,  2048, 5120,  NULL, 'hotspot'),
  ('Weekly',   '7 day internet access',     200,  168, 2048, 5120,  NULL, 'hotspot'),
  ('Monthly',  '30 day internet access',    500,  720, 5120, 10240, NULL, 'hotspot'),
  ('PPPoE Basic', 'Basic home internet',    1000, 720, 5120, 10240, NULL, 'pppoe')
ON CONFLICT DO NOTHING;
