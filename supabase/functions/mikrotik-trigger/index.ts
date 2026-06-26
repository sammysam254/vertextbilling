/**
 * Supabase Edge Function: mikrotik-trigger
 * ─────────────────────────────────────────
 * Called by the captive portal after creating a session.
 * Connects to MikroTik REST API and logs the client in < 1 second.
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

  // Handle GET request (this is the MikroTik heartbeat / poll)
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url)
      const routerId = url.searchParams.get('router')

      if (!routerId) {
        throw new Error('Missing router parameter')
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Update the last_seen timestamp in mikrotik_configs for this specific router
      const { data, error } = await supabase
        .from('mikrotik_configs')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', routerId)
        .select()

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, message: 'Heartbeat received', updated: data?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  try {
    const body = await req.json()
    const { sessionId, paymentId, macAddress, ipAddress, planName, duration, customerId, userId } = body

    // Init Supabase admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch MikroTik config belonging to this ISP account from DB
    const { data: configs } = await supabase
      .from('mikrotik_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .limit(1)

    if (!configs || configs.length === 0) {
      // No MikroTik configured yet – mark session active anyway (manual mode)
      await supabase
        .from('hotspot_sessions')
        .update({ status: 'active' })
        .eq('id', sessionId)

      await supabase
        .from('payments')
        .update({ status: 'confirmed' })
        .eq('id', paymentId)

      await supabase.from('notifications').insert({
        message: `New hotspot session activated (manual mode) – MAC: ${macAddress}`,
        type: 'info'
      })

      return new Response(
        JSON.stringify({ success: true, mode: 'manual', message: 'No MikroTik configured, session marked active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mt = configs[0]

    // 2. Generate a unique hotspot username from MAC + timestamp
    const username = `hs_${macAddress.replace(/:/g, '').toLowerCase().substring(0, 8)}`
    const password = Math.random().toString(36).substring(2, 10)
    const sessionTimeout = `${duration}h`

    // 3. Call MikroTik REST API to add hotspot user
    //    MikroTik REST API endpoint: http://<router>/rest/ip/hotspot/user
    const mtUrl = `http://${mt.host}/rest/ip/hotspot/user`
    const credentials = btoa(`${mt.username}:${mt.password}`)

    let mikrotikSuccess = false
    let mikrotikError = null

    try {
      // Add user to MikroTik hotspot
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
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (addResp.ok) {
        // 4. Login the user immediately via active session
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
      console.error('MikroTik API error:', err)
    }

    // 5. Update session and payment status in Supabase
    const sessionUpdate: any = {
      status: mikrotikSuccess ? 'active' : 'pending',
    }
    if (mikrotikSuccess) {
      sessionUpdate.mikrotik_user = username
    }

    await supabase
      .from('hotspot_sessions')
      .update(sessionUpdate)
      .eq('id', sessionId)

    if (mikrotikSuccess) {
      await supabase
        .from('payments')
        .update({ status: 'confirmed' })
        .eq('id', paymentId)
    }

    // 6. Send notification
    await supabase.from('notifications').insert({
      message: `New client connected – MAC: ${macAddress} | Plan: ${planName} | ${mikrotikSuccess ? 'MikroTik login OK' : 'Cloud connection failed, falling back to router poller'}`,
      type: mikrotikSuccess ? 'success' : 'warning',
    })

    return new Response(
      JSON.stringify({
        success: true,
        mikrotikSuccess,
        mikrotikError,
        username,
        sessionId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
