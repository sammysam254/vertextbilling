/**
 * MikroTik RouterOS Script Generator
 * Generates .rsc scripts based on system configuration
 */

/**
 * Generate the initial hotspot setup script
 */
export function generateHotspotSetupScript(config = {}) {
  const {
    interfaceName = 'ether1',
    hotspotNetwork = '192.168.88.0/24',
    hotspotGateway = '192.168.88.1',
    dnsServer = '8.8.8.8',
    hotspotName = 'Vertex-Hotspot',
    billingServerUrl = 'http://192.168.88.1:3000',
  } = config

  return `# =============================================================
# Vertex Billing – Hotspot Initial Setup Script
# Run this in MikroTik Terminal (Winbox > New Terminal)
# =============================================================

# 1. Set IP address on the hotspot interface
/ip address add address=${hotspotGateway}/24 interface=${interfaceName} comment="Hotspot Gateway"

# 2. Setup DNS
/ip dns set servers=${dnsServer},8.8.4.4 allow-remote-requests=yes

# 3. Setup DHCP server for hotspot clients
/ip pool add name=hs-pool ranges=192.168.88.10-192.168.88.254
/ip dhcp-server add name=hotspot-dhcp interface=${interfaceName} address-pool=hs-pool lease-time=1h disabled=no
/ip dhcp-server network add address=${hotspotNetwork} gateway=${hotspotGateway} dns-server=${hotspotGateway}

# 4. Setup Hotspot server
/ip hotspot setup hotspot-interface=${interfaceName} local-address=${hotspotGateway}/24 \\
  masquerade-network=yes address-pool=hs-pool \\
  select-certificate=no smtp-server=0.0.0.0 \\
  dns-name=${hotspotName} name=${hotspotName}

# 5. Set login page to redirect to billing server
/ip hotspot set [find name=${hotspotName}] login-page=${billingServerUrl}/portal

# 6. Walled garden – allow billing server without login
/ip hotspot walled-garden ip add dst-address=${hotspotGateway} action=accept

# 7. Disable HTML login page (we use external portal)
/ip hotspot profile set [find name=default] login-by=http-chap,http-pap,mac

# 8. NAT masquerade
/ip firewall nat add chain=srcnat out-interface=ether1-wan action=masquerade

:log info "Vertex Billing Hotspot setup complete!"
`
}

/**
 * Generate script to create API user for billing system
 */
export function generateApiUserScript(config = {}) {
  const {
    apiUsername = 'billing-api',
    apiPassword = 'StrongP@ss123!',
  } = config

  return `# =============================================================
# Create MikroTik API User for Billing System
# =============================================================

# 1. Create user group with limited permissions
/user group add name=billing-group policy=api,read,write,local,sensitive

# 2. Create the API user
/user add name=${apiUsername} password=${apiPassword} group=billing-group comment="Vertex Billing API User"

# 3. Enable API service
/ip service enable api
/ip service set api port=8728

:log info "API user '${apiUsername}' created successfully!"
:put "API user created. Use port 8728 for API access."
`
}

/**
 * Generate script to add hotspot user profiles (plans)
 */
export function generatePlanProfilesScript(plans = []) {
  if (!plans.length) {
    return `# No plans configured yet. Add plans in Plan Setup first.`
  }

  const profileLines = plans.map(plan => {
    const rateUp = plan.speed_up_kbps ? `${plan.speed_up_kbps}k` : '0'
    const rateDown = plan.speed_down_kbps ? `${plan.speed_down_kbps}k` : '0'
    const sessionTimeout = plan.duration_hours ? `${plan.duration_hours}h` : '24h'
    const quota = plan.data_cap_mb ? `${plan.data_cap_mb * 1024 * 1024}` : '0'

    return `/ip hotspot user profile add name="${plan.name}" \\
  rate-limit="${rateUp}/${rateDown}" \\
  session-timeout=${sessionTimeout} \\
  shared-users=1 \\
  ${quota !== '0' ? `idle-timeout=5m ` : ''}\\
  keepalive-timeout=none \\
  mac-cookie-timeout=3d \\
  comment="Vertex Plan - ${plan.name} - KSH ${plan.price}"`
  }).join('\n\n')

  return `# =============================================================
# Add Hotspot User Profiles (Plans) to MikroTik
# Run AFTER initial setup script
# =============================================================

# Remove existing billing profiles first
:foreach p in=[/ip hotspot user profile find where comment~"Vertex Plan"] do={
  /ip hotspot user profile remove $p
}

# Add plans
${profileLines}

:log info "Hotspot profiles synced successfully!"
:put "Done! ${plans.length} plan(s) added."
`
}

/**
 * Generate script to add a single hotspot user (after payment)
 */
export function generateAddUserScript(user = {}) {
  const {
    username,
    password,
    macAddress = '',
    planName,
    sessionTimeout = '24h',
  } = user

  return `# =============================================================
# Add Hotspot User (Run after payment confirmed)
# =============================================================

/ip hotspot user add name="${username}" \\
  password="${password}" \\
  profile="${planName}" \\
  ${macAddress ? `mac-address=${macAddress} \\` : ''}
  limit-uptime=${sessionTimeout} \\
  comment="Added by Vertex Billing - $([:tostr [/system clock get date]])"

:log info "User ${username} added with profile ${planName}"
:put "User ${username} activated successfully!"
`
}

/**
 * Generate bulk voucher script
 */
export function generateVouchersScript(vouchers = [], planName = '') {
  if (!vouchers.length) return `# No vouchers to add`

  const lines = vouchers.map(v =>
    `/ip hotspot user add name="${v.code}" password="${v.code}" profile="${planName}" comment="Voucher"`
  ).join('\n')

  return `# =============================================================
# Add Vouchers to MikroTik Hotspot
# Plan: ${planName}
# =============================================================

${lines}

:put "Added ${vouchers.length} voucher(s) for plan ${planName}"
`
}

/**
 * Generate the API login trigger script (scheduled on MikroTik)
 * This polls Supabase for pending logins and activates users
 */
export function generateApiLoginTriggerScript(config = {}) {
  const {
    supabaseUrl = 'https://your-project.supabase.co',
    supabaseAnonKey = 'your-anon-key',
  } = config

  return `# =============================================================
# Vertex Billing – API Login Trigger Script
# Polls Supabase every 2 seconds for pending activations
# Schedule this as a recurring script in MikroTik Scheduler
# =============================================================

# Add to scheduler:
# /system scheduler add name=billing-trigger interval=00:00:02 \\
#   on-event="/system script run billing-trigger"

:global billingUrl "${supabaseUrl}/functions/v1/mikrotik-trigger"
:global billingKey "${supabaseAnonKey}"

:do {
  /tool fetch url=($billingUrl) \\
    http-method=get \\
    http-header-field="Authorization: Bearer $billingKey" \\
    output=none \\
    as-value
} on-error={
  :log error "Billing trigger failed - check network"
}
`
}

/**
 * Generate the remove user / disconnect script
 */
export function generateRemoveUserScript(username = '') {
  return `# =============================================================
# Remove / Disconnect Hotspot User
# =============================================================

# Disconnect active session
:if ([:len [/ip hotspot active find where user="${username}"]] > 0) do={
  /ip hotspot active remove [find where user="${username}"]
  :log info "Disconnected active session for ${username}"
}

# Remove user entry
:if ([:len [/ip hotspot user find where name="${username}"]] > 0) do={
  /ip hotspot user remove [find where name="${username}"]
  :log info "Removed hotspot user ${username}"
}

:put "User ${username} removed successfully"
`
}
