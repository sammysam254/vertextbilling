/**
 * MikroTik RouterOS Script Generator
 * Generates .rsc scripts based on system configuration
 */

// --- Helper scripts (small utilities) -----------------------------------------

export function generatePlanProfilesScript(plans = []) {
  if (!plans.length) {
    return `# No plans configured yet. Add plans in Plan Setup first.`
  }
  const profileLines = plans.map(plan => {
    const rateUp   = plan.speed_up_kbps   ? `${plan.speed_up_kbps}k`   : '0'
    const rateDown = plan.speed_down_kbps ? `${plan.speed_down_kbps}k` : '0'
    const sessionTimeout = plan.duration_hours ? `${plan.duration_hours}h` : '24h'
    return `/ip hotspot user profile add name="${plan.name}" rate-limit="${rateUp}/${rateDown}" session-timeout=${sessionTimeout} shared-users=1 keepalive-timeout=none mac-cookie-timeout=3d comment="Vertex Plan - ${plan.name} - KSH ${plan.price}"`
  }).join('\n')

  return `# =============================================================
# Add Hotspot User Profiles (Plans) to MikroTik
# =============================================================

:foreach p in=[/ip hotspot user profile find where comment~"Vertex Plan"] do={
  /ip hotspot user profile remove $p
}

${profileLines}

:log info "Hotspot profiles synced!"
:put "Done! ${plans.length} plan(s) added."
`
}

export function generateAddUserScript(user = {}) {
  const { username, password, macAddress = '', planName, sessionTimeout = '24h' } = user
  return `# Add Hotspot User after payment
/ip hotspot user add name="${username}" password="${password}" profile="${planName}" ${macAddress ? `mac-address=${macAddress} ` : ''}limit-uptime=${sessionTimeout} comment="Added by Vertex Billing"
:log info "User ${username} activated"
`
}

export function generateVouchersScript(vouchers = [], planName = '') {
  if (!vouchers.length) return `# No vouchers to add`
  const lines = vouchers.map(v =>
    `/ip hotspot user add name="${v.code}" password="${v.code}" profile="${planName}" comment="Voucher"`
  ).join('\n')
  return `# Add Vouchers\n${lines}\n:put "Added ${vouchers.length} voucher(s)"`
}

export function generateRemoveUserScript(username = '') {
  return `# Remove Hotspot User
:if ([:len [/ip hotspot active find where user="${username}"]] > 0) do={
  /ip hotspot active remove [find where user="${username}"]
}
:if ([:len [/ip hotspot user find where name="${username}"]] > 0) do={
  /ip hotspot user remove [find where name="${username}"]
}
:put "User ${username} removed"
`
}

// --- Main Unified Setup Script ------------------------------------------------

export function generateUnifiedSetupScript(config = {}, plans = []) {
  const {
    id             = 'ROUTER_ID',
    interfaceName  = 'bridge-hotspot', // Changed default to bridge-hotspot
    hotspotNetwork = '192.168.88.0/24',
    hotspotGateway = '192.168.88.1',
    dnsServer      = '8.8.8.8',
    hotspotName    = 'Vertex-Hotspot',
    billingServerUrl = 'http://192.168.88.1:3000',
    apiUsername    = 'billing-api',
    apiPassword    = 'StrongP@ss123!',
    supabaseUrl    = 'https://your-project.supabase.co',
    supabaseAnonKey = 'your-anon-key',
    user_id        = 'USER_ID',
  } = config

  // -- Walled-garden for billing portal --------------------------------------
  let walledGardenCmd = ''
  try {
    const u = new URL(billingServerUrl)
    if (u.hostname && !/^[0-9.]+$/.test(u.hostname)) {
      walledGardenCmd = `/ip hotspot walled-garden add dst-host="${u.hostname}" action=allow`
    } else if (u.hostname) {
      walledGardenCmd = `/ip hotspot walled-garden ip add dst-address=${u.hostname} action=accept`
    }
  } catch (_) {
    walledGardenCmd = `/ip hotspot walled-garden ip add dst-address=${hotspotGateway} action=accept`
  }

  // -- Plan profiles ----------------------------------------------------------
  const profileLines = plans.map(plan => {
    const up   = plan.speed_up_kbps   ? `${plan.speed_up_kbps}k`   : '0'
    const down = plan.speed_down_kbps ? `${plan.speed_down_kbps}k` : '0'
    const to   = plan.duration_hours  ? `${plan.duration_hours}h`  : '24h'
    return `/ip hotspot user profile add name="${plan.name}" rate-limit="${up}/${down}" session-timeout=${to} shared-users=1 keepalive-timeout=none mac-cookie-timeout=3d comment="Vertex Plan - ${plan.name} - KSH ${plan.price}"`
  }).join('\n')

  // -- Build the billing-trigger source string with CORRECT escaping ----------
  const Q  = '\\"'
  const NL = '\n'
  const fetchUrl    = supabaseUrl + '/functions/v1/mikrotik-trigger?router=' + id
  const authHeader  = 'Authorization: Bearer ' + supabaseAnonKey + ',apikey: ' + supabaseAnonKey

  const scriptLines = [
    ':do {',
    '/tool fetch url=' + Q + fetchUrl + Q
      + ' check-certificate=no'
      + ' http-method=get'
      + ' http-header-field=' + Q + authHeader + Q
      + ' keep-result=yes'
      + ' dst-path=action.rsc',
    ':if ([:len [/file find where name=action.rsc]] > 0) do={',
    '  :if ([/file get [find name=action.rsc] size] > 15) do={',
    '    :delay 500ms',
    '    /import action.rsc',
    '  }',
    '  /file remove [find name=action.rsc]',
    '}',
    '} on-error={',
    '  :log error ' + Q + 'Vertex billing heartbeat failed' + Q,
    '}',
  ]
  const triggerSource = scriptLines.join(NL)

  // -- Login.html: use single-quoted HTML attrs so no RouterOS " conflict ----
  const loginHtml = (
    "<html><head>" +
    "<meta http-equiv='refresh' content='0; url=" +
      billingServerUrl + "/portal" +
      "?isp=" + user_id +
      "&mac=$(mac)" +
      "&ip=$(ip)" +
      "&link-orig=$(link-orig-esc)" +
    "'>" +
    "</head><body><p>Redirecting to captive portal...</p></body></html>"
  )

  return `# =============================================================
# Vertex Billing - Unified MikroTik Setup Script v5 (Multi-Port & Wi-Fi Bridge)
# Run in Winbox > New Terminal
# =============================================================

:log info "Vertex Billing: Starting setup (Router ID: ${id})..."

# -- 1. Create Hotspot Bridge (bridge-hotspot) ----------------
:if ([:len [/interface bridge find where name="bridge-hotspot"]] = 0) do={
  /interface bridge add name=bridge-hotspot comment="Vertex Hotspot Bridge"
}

# -- 2. Add Ethernet & Wi-Fi interfaces to the bridge ---------
# Add all ethernet interfaces except ether1 (WAN)
:foreach p in=[/interface ethernet find] do={
  :local ethName [/interface ethernet get $p name]
  :if ($ethName != "ether1") do={
    :if ([:len [/interface bridge port find where interface=$ethName]] > 0) do={
      /interface bridge port remove [find where interface=$ethName]
    }
    /interface bridge port add bridge=bridge-hotspot interface=$ethName comment="Vertex LAN Port"
    :log info "Vertex Billing: Added interface $ethName to hotspot bridge"
  }
}

# Add all wireless (Wi-Fi) interfaces
:foreach w in=[/interface wireless find] do={
  :local wlanName [/interface wireless get $w name]
  :if ([:len [/interface bridge port find where interface=$wlanName]] > 0) do={
    /interface bridge port remove [find where interface=$wlanName]
  }
  /interface bridge port add bridge=bridge-hotspot interface=$wlanName comment="Vertex Wi-Fi Port"
  :log info "Vertex Billing: Added interface $wlanName to hotspot bridge"
}

# Assign the IP address to the bridge
:if ([:len [/ip address find where interface="bridge-hotspot"]] = 0) do={
  /ip address add address=${hotspotGateway}/24 interface=bridge-hotspot comment="Hotspot Gateway"
}

# -- 3. DNS ----------------------------------------------------
/ip dns set servers=${dnsServer},8.8.4.4 allow-remote-requests=yes

# -- 4. DHCP server on bridge-hotspot --------------------------
:if ([:len [/ip pool find where name="hs-pool"]] = 0) do={
  /ip pool add name=hs-pool ranges=192.168.88.10-192.168.88.254
}
:if ([:len [/ip dhcp-server find where interface="bridge-hotspot"]] = 0) do={
  /ip dhcp-server add name=hotspot-dhcp interface=bridge-hotspot address-pool=hs-pool lease-time=1h disabled=no
}
:if ([:len [/ip dhcp-server network find where address="${hotspotNetwork}"]] = 0) do={
  /ip dhcp-server network add address=${hotspotNetwork} gateway=${hotspotGateway} dns-server=${hotspotGateway}
}

# -- 5. Hotspot profile & server on bridge-hotspot -------------
:if ([:len [/ip hotspot profile find where name="Vertex-Profile"]] > 0) do={
  /ip hotspot profile remove [find name="Vertex-Profile"]
}
/ip hotspot profile add name="Vertex-Profile" hotspot-address=${hotspotGateway} dns-name="${hotspotName}" html-directory=hotspot login-by=http-chap,http-pap,mac

:if ([:len [/ip hotspot find where name="${hotspotName}"]] > 0) do={
  /ip hotspot remove [find name="${hotspotName}"]
}
/ip hotspot add name="${hotspotName}" interface=bridge-hotspot address-pool=hs-pool profile="Vertex-Profile" disabled=no

# -- 6. Walled garden ------------------------------------------
/ip hotspot walled-garden ip add dst-address=${hotspotGateway} action=accept
${walledGardenCmd}
/ip hotspot walled-garden add dst-host="*.supabase.co" action=allow
/ip hotspot walled-garden add dst-host="*.netlify.app" action=allow

# -- 7. Write login.html (waits up to 30s for hotspot to start) -
:local loginDone false
:local attempts 0
:delay 5s
:while ($attempts < 15 and !$loginDone) do={
  :if ([:len [/file find where name="hotspot/login.html"]] > 0) do={
    /file set [find name="hotspot/login.html"] contents="${loginHtml}"
    :set loginDone true
    :log info "Vertex Billing: login.html updated OK"
  } else={
    :delay 2s
    :set attempts ($attempts + 1)
  }
}
:if (!$loginDone) do={
  :log warning "Vertex Billing: hotspot/login.html not found yet"
}

# -- 8. API user for REST access -------------------------------
:if ([:len [/user group find where name="billing-group"]] = 0) do={
  /user group add name=billing-group policy=api,read,write,local,sensitive
}
:if ([:len [/user find where name="${apiUsername}"]] > 0) do={
  /user remove [find name="${apiUsername}"]
}
/user add name=${apiUsername} password=${apiPassword} group=billing-group comment="Vertex Billing API"
/ip service enable api
/ip service set api port=8728

# -- 9. Sync plan profiles -------------------------------------
:foreach p in=[/ip hotspot user profile find where comment~"Vertex Plan"] do={
  /ip hotspot user profile remove $p
}
${profileLines || '# (No plans configured yet)'}

# -- 10. Heartbeat + session poller (uses Winbox-safe scheduling) 
/system scheduler remove [find name=billing-trigger-scheduler]
/system scheduler add name=billing-trigger-scheduler interval=5s on-event=":do {/tool fetch url=\"${supabaseUrl}/functions/v1/mikrotik-trigger?router=${id}\" check-certificate=no http-method=get http-header-field=\"Authorization: Bearer ${supabaseAnonKey},apikey: ${supabaseAnonKey}\" keep-result=no} on-error={:log error \"Heartbeat failed\"}"

# -- 11. NAT masquerade ----------------------------------------
:if ([:len [/ip firewall nat find where comment="NAT Masquerade"]] = 0) do={
  :if ([:len [/interface list find where name="WAN"]] > 0) do={
    /ip firewall nat add chain=srcnat out-interface-list=WAN action=masquerade comment="NAT Masquerade"
  } else={
    /ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="NAT Masquerade"
  }
}

:log info "Vertex Billing setup complete!"
:put "========================================================="
:put " Setup done! Router ID: ${id}"
:put " Connected all LAN ports and Wi-Fi networks to Hotspot."
:put " Router status will show ONLINE in 5 seconds."
:put "========================================================="
`
}
