# Vertex Billing – WiFi Hotspot Management System

Professional WiFi Hotspot Billing & Management for rental and ISP use.
Hosted on **Netlify** • Backend on **Supabase** • MikroTik router integration

---

## Live Deployment on Netlify

### Step 1 — Push to GitHub

1. Create a new GitHub repository (private recommended)
2. Upload the contents of this folder to the repo  
   *(The `.env` file is excluded by `.gitignore` — good, never commit keys)*

### Step 2 — Connect to Netlify

1. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
2. Select your GitHub repo
3. Netlify auto-detects settings from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy site**

### Step 3 — Add Environment Variables

In **Netlify → Site → Environment variables**, add:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon key |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `VITE_APP_NAME` | `Vertex Billing` |
| `VITE_CAPTIVE_PORTAL_URL` | `https://your-site.netlify.app/portal` |

After adding variables → **Trigger redeploy**

### Step 4 — Run the Database Migration

1. Open **Supabase Dashboard → SQL Editor**
2. Paste the full contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run** — this creates all tables, policies, and sample plans

### Step 5 — Create Admin User

- **Supabase → Authentication → Users → Add user**
- Enter email + password — these are your admin login credentials

### Step 6 — Deploy the Edge Function

```bash
# Install Supabase CLI (one-time)
npm install -g supabase

supabase login
supabase functions deploy mikrotik-trigger --project-ref YOUR_PROJECT_REF
```

Set Edge Function secrets in **Supabase → Edge Functions → Secrets**:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## MikroTik Setup (4 Scripts)

Go to the **Mikrotiks** page in your Vertex Billing dashboard.
Paste each script in order into **Winbox → New Terminal**:

| # | Script | Purpose |
|---|--------|---------|
| 1 | Initial Hotspot Setup | Configure hotspot, DHCP, DNS, NAT |
| 2 | Create API User | API credentials for Vertex Billing |
| 3 | Sync Plan Profiles | Speed profiles matching your plans |
| 4 | API Login Trigger | Instant client activation scheduler |

**After running all 4 scripts**, add your MikroTik to the database:
```sql
INSERT INTO mikrotik_configs (name, host, port, username, password)
VALUES ('Main Router', '192.168.88.1', 8728, 'billing-api', 'YourPassword');
```

**Point MikroTik at the Netlify portal:**
```
/ip hotspot profile set [find name=default] login-page=https://your-site.netlify.app/portal
```

---

## How < 1 Second Connection Works

```
Client selects plan → pays → "Pay" button clicked
    ↓
Supabase: payment + session created (pending)
    ↓  immediately
Edge Function fires → MikroTik REST API (port 8728)
    ↓  < 500ms
Client is logged into hotspot
    ↓
Portal shows ✓ "You're Connected!"
```

---

## Pages

| Route | Page |
|-------|------|
| `/login` | Admin login |
| `/dashboard` | Stats, charts, PPPoE/Hotspot tabs |
| `/customers` | Customer management |
| `/online` | Live active sessions |
| `/payments` | Payment recording & history |
| `/transactions` | Transaction log |
| `/plans` | Plan setup (hotspot & PPPoE) |
| `/vouchers` | Generate & print vouchers |
| `/coupons` | Discount coupons |
| `/notifications` | Real-time notifications |
| `/settings` | Theme, business settings |
| `/mikrotiks` | RouterOS script generator |
| `/portal` | **Public captive portal** (clients land here) |

---

*Built with React + Vite + Supabase + Recharts • Deployed on Netlify*
