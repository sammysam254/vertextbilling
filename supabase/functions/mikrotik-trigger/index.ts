/**
 * Supabase Edge Function: mikrotik-trigger
 * ─────────────────────────────────────────
 * GET  ?router=UUID  → heartbeat + process pending sessions → return RouterOS commands
 * POST              → called by captive portal after payment to trigger immediate login
 *
 * Deploy with:
 *   supabase functions deploy mikrotik-trigger
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ─── GET: MikroTik router heartbeat + session processing ─────────────────────
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url)
      let routerId = url.searchParams.get('router')
      
      if (!routerId) {
        const pathParts = url.pathname.split('/')
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart.length === 36 && lastPart.includes('-')) {
          routerId = lastPart
        }
      }

      if (!routerId || routerId === 'ROUTER_ID') {
        return new Response(
          '# Error: Router ID not configured. Re-copy the setup script from the Vertex Billing dashboard.',
          { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
        )
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // 1. Update heartbeat timestamp
      const { error: heartbeatError } = await supabase
        .from('mikrotik_configs')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', routerId)

      if (heartbeatError) {
        console.error('Heartbeat update error:', heartbeatError)
        return new Response(
          `# Heartbeat error: ${heartbeatError.message}`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
        )
      }

      // 2. Get this router's owner (user_id)
      const { data: routerConfig, error: configError } = await supabase
        .from('mikrotik_configs')
        .select('user_id')
        .eq('id', routerId)
        .single()

      if (configError || !routerConfig) {
        return new Response(
          `# Error: Router ${routerId} not found in database.`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
        )
      }

      // 3. Find all pending hotspot sessions for this router's owner
      const { data: pendingSessions, error: sessionsError } = await supabase
        .from('hotspot_sessions')
        .select('*, plans(*)')
        .eq('user_id', routerConfig.user_id)
        .eq('status', 'pending')
        .not('mac_address', 'is', null)
        .neq('mac_address', '')

      if (sessionsError) {
        console.error('Sessions query error:', sessionsError)
        return new Response(
          '# Heartbeat OK - session query error',
          { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
        )
      }

      // No pending sessions - just heartbeat
      if (!pendingSessions || pendingSessions.length === 0) {
        return new Response(
          '# Heartbeat OK',
          { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
        )
      }

      // 4. Build RouterOS commands for each pending session
      let commands = ''
      for (const sess of pendingSessions) {
        const macClean = sess.mac_address.replace(/:/g, '').toLowerCase().substring(0, 12)
        const username = `hs_${macClean}`
        const password = Math.random().toString(36).substring(2, 10)
        const planName = sess.plans?.name || 'default'
        const timeout = `${sess.plans?.duration_hours || 24}h`

        commands += `# Activating session ${sess.id}\n`
        commands += `/ip hotspot user remove [find where name="${username}"]\n`
        commands += `/ip hotspot user add name="${username}" password="${password}" profile="${planName}" limit-uptime=${timeout} comment="Vertex ${sess.id}"\n`
        commands += `:delay 500ms\n`
        commands += `/ip hotspot active login user="${username}" password="${password}" ip="${sess.ip_address || ''}" mac-address="${sess.mac_address}"\n\n`

        // Mark session active and confirm payment
        await supabase
          .from('hotspot_sessions')
          .update({ status: 'active', mikrotik_user: username })
          .eq('id', sess.id)

        await supabase
          .from('payments')
          .update({ status: 'confirmed' })
          .eq('customer_id', sess.customer_id)
          .eq('status', 'pending')

        // Notify dashboard
        await supabase.from('notifications').insert({
          user_id: routerConfig.user_id,
          message: `✅ Client connected – MAC: ${sess.mac_address} | Plan: ${planName}`,
          type: 'success'
        })
      }

      return new Response(commands, {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })

    } catch (err) {
      console.error('GET handler error:', err)
      return new Response(
        `# Error: ${err.message}`,
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
      )
    }
  }

  // ─── POST: Captive portal triggers immediate MikroTik login ──────────────────
  try {
    const body = await req.json()
    const { sessionId, paymentId, macAddress, ipAddress, planName, duration, customerId, userId } = body

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch MikroTik config for this ISP account
    const { data: configs } = await supabase
      .from('mikrotik_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .limit(1)

    if (!configs || configs.length === 0) {
      // No MikroTik configured – mark session active (manual/cloud-poller mode)
      await supabase.from('hotspot_sessions').update({ status: 'active' }).eq('id', sessionId)
      await supabase.from('payments').update({ status: 'confirmed' }).eq('id', paymentId)
      await supabase.from('notifications').insert({
        user_id: userId,
        message: `New session (cloud poller mode) – MAC: ${macAddress}`,
        type: 'info'
      })
      return new Response(
        JSON.stringify({ success: true, mode: 'cloud-poller' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mt = configs[0]
    const username = `hs_${macAddress.replace(/:/g, '').toLowerCase().substring(0, 12)}`
    const password = Math.random().toString(36).substring(2, 10)
    const sessionTimeout = `${duration}h`

    let mikrotikSuccess = false
    let mikrotikError = null

    try {
      const mtUrl = `http://${mt.host}/rest/ip/hotspot/user`
      const credentials = btoa(`${mt.username}:${mt.password}`)

      const addResp = await fetch(mtUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: username,
          password: password,
          profile: planName,
          'mac-address': macAddress,
          'limit-uptime': sessionTimeout,
          comment: `Vertex Billing session ${sessionId}`,
        }),
        signal: AbortSignal.timeout(5000),
      })

      if (addResp.ok) {
        const loginUrl = `http://${mt.host}/rest/ip/hotspot/active/login`
        const loginResp = await fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user: username,
            password: password,
            ip: ipAddress,
            'mac-address': macAddress,
          }),
          signal: AbortSignal.timeout(3000),
        })
        mikrotikSuccess = loginResp.ok
      }
    } catch (err) {
      mikrotikError = err.message
      console.error('MikroTik REST API error:', err)
    }

    // Update session and payment status
    await supabase
      .from('hotspot_sessions')
      .update({
        status: mikrotikSuccess ? 'active' : 'pending',
        ...(mikrotikSuccess ? { mikrotik_user: username } : {})
      })
      .eq('id', sessionId)

    if (mikrotikSuccess) {
      await supabase.from('payments').update({ status: 'confirmed' }).eq('id', paymentId)
    }

    await supabase.from('notifications').insert({
      user_id: userId,
      message: `${mikrotikSuccess ? '✅' : '⏳'} Client ${macAddress} | Plan: ${planName} | ${mikrotikSuccess ? 'Connected' : 'Awaiting cloud poller'}`,
      type: mikrotikSuccess ? 'success' : 'info',
    })

    return new Response(
      JSON.stringify({ success: true, mikrotikSuccess, mikrotikError, username, sessionId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
