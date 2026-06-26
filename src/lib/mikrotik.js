/**
 * MikroTik RouterOS Script Generator
 * Generates .rsc scripts based on system configuration
 */

/**
 * Generate the initial hotspot setup script
 */
export function generateHotspotSetupScript(config = {}) {
  const {
    interfaceName = 'ether2',
    hotspotNetwork = '192.168.88.0/24',
    hotspotGateway = '192.168.88.1',
    dnsServer = '8.8.8.8',
    hotspotName = 'Vertex-Hotspot',
    billingServerUrl = 'http://192.168.88.1:3000',
  } = config

  let walledGardenCmds = ''
  try {
    const url = new URL(billingServerUrl)
    if (url.hostname && !/^[0-9.]+$/.test(url.hostname)) {
      walledGardenCmds = `/ip hotspot walled-garden add dst-host="${url.hostname}" action=accept`
    } else if (url.hostname) {
      walledGardenCmds = `/ip hotspot walled-garden ip add dst-address=${url.hostname} action=accept`
    }
  } catch (e) {
    walledGardenCmds = `/ip hotspot walled-garden ip add dst-address=${hotspotGateway} action=accept`
  }

  return `# =============================================================
# Vertex Billing – Hotspot Initial Setup Script
# Run this in MikroTik Terminal (Winbox > New Terminal)
# =============================================================

# 1. Prepare interface
# If interface is currently a port of a bridge, remove it to allow direct configuration
:if ([:len [/interface bridge port find where interface=${interfaceName}]] > 0) do={
  /interface bridge port remove [find where interface=${interfaceName}]
}

# Set IP address on the hotspot interface if not already set
:if ([:len [/ip address find where interface="${interfaceName}"]] = 0) do={
  /ip address add address=${hotspotGateway}/24 interface=${interfaceName} comment="Hotspot Gateway"
}

# 2. Setup DNS
/ip dns set servers=${dnsServer},8.8.4.4 allow-remote-requests=yes

# 3. Setup DHCP server for hotspot clients
:if ([:len [/ip pool find where name="hs-pool"]] = 0) do={
  /ip pool add name=hs-pool ranges=192.168.88.10-192.168.88.254
}
:if ([:len [/ip dhcp-server find where interface="${interfaceName}"]] = 0) do={
  /ip dhcp-server add name=hotspot-dhcp interface=${interfaceName} address-pool=hs-pool lease-time=1h disabled=no
}
:if ([:len [/ip dhcp-server network find where address="${hotspotNetwork}"]] = 0) do={
  /ip dhcp-server network add address=${hotspotNetwork} gateway=${hotspotGateway} dns-server=${hotspotGateway}
}

# 4. Setup Hotspot Profile (Non-interactive)
:if ([:len [/ip hotspot profile find where name="Vertex-Profile"]] > 0) do={
  /ip hotspot profile remove [find name="Vertex-Profile"]
}
/ip hotspot profile add name="Vertex-Profile" \\
  hotspot-address=${hotspotGateway} \\
  dns-name="${hotspotName}" \\
  html-directory="hotspot" \\
  login-by=http-chap,http-pap,mac

# 5. Setup Hotspot Server (Non-interactive)
:if ([:len [/ip hotspot find where name="${hotspotName}"]] > 0) do={
  /ip hotspot remove [find name="${hotspotName}"]
}
/ip hotspot add name="${hotspotName}" \\
  interface=${interfaceName} \\
  address-pool=hs-pool \\
  profile="Vertex-Profile" \\
  disabled=no

# 6. Walled garden – allow billing server and portal without login
/ip hotspot walled-garden ip add dst-address=${hotspotGateway} action=accept
${walledGardenCmds}

# 7. Setup external portal redirection in login.html
# Overwrite default login.html to automatically redirect client browsers to captive portal
:delay 2s
/file set [find name="hotspot/login.html"] contents="<html><head><meta http-equiv=\\"refresh\\" content=\\"0; url=${billingServerUrl}/portal?mac=\\\\$(mac)&ip=\\\\$(ip)&link-orig=\\\\$(link-orig-esc)\\" /></head></html>"

# 8. NAT masquerade for internet access
:if ([:len [/ip firewall nat find where comment="NAT Masquerade"]] = 0) do={
  :if ([:len [/interface list find where name="WAN"]] > 0) do={
    /ip firewall nat add chain=srcnat out-interface-list=WAN action=masquerade comment="NAT Masquerade"
  } else={
    /ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="NAT Masquerade"
  }
}

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
    id = 'ROUTER_ID',
    supabaseUrl = 'https://your-project.supabase.co',
    supabaseAnonKey = 'your-anon-key',
  } = config

  return `# =============================================================
# Vertex Billing – API Login Trigger Setup Script
# Run this in MikroTik Terminal (Winbox > New Terminal)
# This automatically configures the script and schedules it to run every 2s
# =============================================================

# 1. Create the API trigger script
/system script remove [find name=billing-trigger]
/system script add name=billing-trigger source=":do {
  /tool fetch url=\\"${supabaseUrl}/functions/v1/mikrotik-trigger?router=${id}\\" check-certificate=no \\
    http-method=get \\
    http-header-field=\\"Authorization: Bearer ${supabaseAnonKey}\\" \\
    output=none as-value
} on-error={
  :log error \\"Billing trigger failed - check network\\"
}"

# 2. Schedule the script to run every 2 seconds
/system scheduler remove [find name=billing-trigger-scheduler]
/system scheduler add name=billing-trigger-scheduler interval=2s on-event="/system script run billing-trigger"

:log info "Vertex Billing API Login Trigger setup complete!"
:put "Setup complete! Script 'billing-trigger' and Scheduler 'billing-trigger-scheduler' created."
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

/**
 * Generate a single unified setup script that configures everything
 */
export function generateUnifiedSetupScript(config = {}, plans = []) {
  const {
    id = 'ROUTER_ID',
    interfaceName = 'ether2',
    hotspotNetwork = '192.168.88.0/24',
    hotspotGateway = '192.168.88.1',
    dnsServer = '8.8.8.8',
    hotspotName = 'Vertex-Hotspot',
    billingServerUrl = 'http://192.168.88.1:3000',
    apiUsername = 'billing-api',
    apiPassword = 'StrongP@ss123!',
    supabaseUrl = 'https://your-project.supabase.co',
    supabaseAnonKey = 'your-anon-key',
    user_id = 'USER_ID',
  } = config

  let walledGardenCmds = ''
  try {
    const url = new URL(billingServerUrl)
    if (url.hostname && !/^[0-9.]+$/.test(url.hostname)) {
      walledGardenCmds = `/ip hotspot walled-garden add dst-host="${url.hostname}" action=accept`
    } else if (url.hostname) {
      walledGardenCmds = `/ip hotspot walled-garden ip add dst-address=${url.hostname} action=accept`
    }
  } catch (e) {
    walledGardenCmds = `/ip hotspot walled-garden ip add dst-address=${hotspotGateway} action=accept`
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
# Vertex Billing – Unified MikroTik Setup Script
# Run this in Winbox > New Terminal on a fresh or reset router.
# This configures network, hotspot, API credentials, syncs plans,
# and sets up the 2-second cloud trigger.
# =============================================================

:log info "Starting Vertex Billing Unified Setup..."
:put "Setting up Vertex Billing on interface ${interfaceName}..."

# 1. Prepare interface
# If interface is currently a port of a bridge, remove it to allow direct configuration
:if ([:len [/interface bridge port find where interface=${interfaceName}]] > 0) do={
  /interface bridge port remove [find where interface=${interfaceName}]
}

# Set IP address on the hotspot interface if not already set
:if ([:len [/ip address find where interface="${interfaceName}"]] = 0) do={
  /ip address add address=${hotspotGateway}/24 interface=${interfaceName} comment="Hotspot Gateway"
}

# 2. Setup DNS
/ip dns set servers=${dnsServer},8.8.4.4 allow-remote-requests=yes

# 3. Setup DHCP server for hotspot clients
:if ([:len [/ip pool find where name="hs-pool"]] = 0) do={
  /ip pool add name=hs-pool ranges=192.168.88.10-192.168.88.254
}
:if ([:len [/ip dhcp-server find where interface="${interfaceName}"]] = 0) do={
  /ip dhcp-server add name=hotspot-dhcp interface=${interfaceName} address-pool=hs-pool lease-time=1h disabled=no
}
:if ([:len [/ip dhcp-server network find where address="${hotspotNetwork}"]] = 0) do={
  /ip dhcp-server network add address=${hotspotNetwork} gateway=${hotspotGateway} dns-server=${hotspotGateway}
}

# 4. Setup Hotspot Profile (Non-interactive)
:if ([:len [/ip hotspot profile find where name="Vertex-Profile"]] > 0) do={
  /ip hotspot profile remove [find name="Vertex-Profile"]
}
/ip hotspot profile add name="Vertex-Profile" \\
  hotspot-address=${hotspotGateway} \\
  dns-name="${hotspotName}" \\
  html-directory="hotspot" \\
  login-by=http-chap,http-pap,mac

# 5. Setup Hotspot Server (Non-interactive)
:if ([:len [/ip hotspot find where name="${hotspotName}"]] > 0) do={
  /ip hotspot remove [find name="${hotspotName}"]
}
/ip hotspot add name="${hotspotName}" \\
  interface=${interfaceName} \\
  address-pool=hs-pool \\
  profile="Vertex-Profile" \\
  disabled=no

# 6. Walled garden – allow billing server and portal without login
/ip hotspot walled-garden ip add dst-address=${hotspotGateway} action=accept
${walledGardenCmds}

# 7. Setup external portal redirection in login.html
# Overwrite default login.html to automatically redirect client browsers to captive portal
:delay 2s
/file set [find name="hotspot/login.html"] contents="<html><head><meta http-equiv=\\"refresh\\" content=\\"0; url=${billingServerUrl}/portal?isp=${user_id}&mac=\\\\$(mac)&ip=\\\\$(ip)&link-orig=\\\\$(link-orig-esc)\\" /></head></html>"

# 8. Create API User for Billing Connection
:if ([:len [/user group find where name="billing-group"]] = 0) do={
  /user group add name=billing-group policy=api,read,write,local,sensitive
}
:if ([:len [/user find where name="${apiUsername}"]] > 0) do={
  /user remove [find name="${apiUsername}"]
}
/user add name=${apiUsername} password=${apiPassword} group=billing-group comment="Vertex Billing API User"
/ip service enable api
/ip service set api port=8728

# 9. Sync Plan Profiles
# Remove existing billing user profiles
:foreach p in=[/ip hotspot user profile find where comment~"Vertex Plan"] do={
  /ip hotspot user profile remove $p
}
# Add plans
${profileLines}

# 10. Create Cloud Trigger Script & Scheduler
/system script remove [find name=billing-trigger]
/system script add name=billing-trigger source=":do {
  /tool fetch url=\\"${supabaseUrl}/rest/v1/rpc/checkin_router\\" check-certificate=no \\
    http-method=post \\
    http-header-field=\\"apikey: ${supabaseAnonKey},Authorization: Bearer ${supabaseAnonKey},Content-Type: application/x-www-form-urlencoded,Accept: text/plain\\" \\
    http-data=\\"router_id=${id}\\" \\
    keep-result=yes \\
    dst-path=\\"action.rsc\\"

  :if ([:len [/file find where name=\\"action.rsc\\"]] > 0) do={
    :if ([/file get action.rsc size] > 2) do={
      :delay 1s
      /import action.rsc
    }
  }
} on-error={
  :log error \\"Billing trigger heartbeat failed\\"
}"

# Schedule the trigger script to run every 2 seconds
/system scheduler remove [find name=billing-trigger-scheduler]
/system scheduler add name=billing-trigger-scheduler interval=2s on-event="/system script run billing-trigger"

# NAT masquerade for internet access
:if ([:len [/ip firewall nat find where comment="NAT Masquerade"]] = 0) do={
  :if ([:len [/interface list find where name="WAN"]] > 0) do={
    /ip firewall nat add chain=srcnat out-interface-list=WAN action=masquerade comment="NAT Masquerade"
  } else={
    /ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="NAT Masquerade"
  }
}

:log info "Vertex Billing setup successfully complete!"
:put "========================================================="
:put " Vertex Billing configuration is complete!"
:put " Router status will show 'Online' in your dashboard."
:put "========================================================="
`
}
