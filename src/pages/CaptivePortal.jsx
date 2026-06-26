import React, { useState, useEffect, useRef } from 'react'
import { Wifi, CheckCircle, AlertCircle, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'

/**
 * CaptivePortal
 * ─────────────
 * Served at /portal — MikroTik redirects unauthenticated clients here.
 * URL params provided by MikroTik hotspot:
 *   ?mac=AA:BB:CC:DD:EE:FF&ip=192.168.88.x&username=&link-orig=...
 *
 * Flow:
 *  1. Load plans from Supabase
 *  2. Customer selects plan + enters phone
 *  3. On "Pay" → create pending payment in Supabase
 *  4. Supabase Edge Function fires → calls MikroTik REST API → login < 1 sec
 *  5. Captive portal polls for session status → shows success
 */
export default function CaptivePortal() {
  const params = new URLSearchParams(window.location.search)
  const macAddress = params.get('mac') || params.get('mac-address') || ''
  const clientIp   = params.get('ip')  || ''
  const linkOrig   = params.get('link-orig') || params.get('link-login-only') || ''
  const ispId      = params.get('isp') || ''

  const [plans,   setPlans]   = useState([])
  const [selected, setSelected] = useState(null)
  const [phone,    setPhone]    = useState('')
  const [step,     setStep]     = useState('plans')   // plans | paying | connecting | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [payment,  setPayment]  = useState(null)
  const [countdown, setCountdown] = useState(30)
  const pollRef = useRef(null)

  useEffect(() => {
    let query = supabase
      .from('plans')
      .select('*')
      .eq('type', 'hotspot')
      .eq('active', true)

    if (ispId) {
      query = query.eq('user_id', ispId)
    }

    query
      .order('price', { ascending: true })
      .then(({ data }) => setPlans(data || []))

    return () => clearInterval(pollRef.current)
  }, [ispId])

  function formatDuration(h) {
    if (!h) return ''
    if (h < 24) return `${h} hour${h > 1 ? 's' : ''}`
    const d = Math.floor(h / 24)
    return `${d} day${d > 1 ? 's' : ''}`
  }

  function formatSpeed(kbps) {
    if (!kbps) return 'Unlimited'
    return kbps >= 1000 ? `${(kbps / 1000).toFixed(0)}Mbps` : `${kbps}Kbps`
  }

  async function handlePay() {
    if (!selected) return
    if (!phone.trim()) { setErrorMsg('Please enter your phone number'); return }

    setStep('paying')
    setErrorMsg('')

    try {
      // 1. Find or create customer by phone + MAC
      let customerId = null
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (existing) {
        customerId = existing.id
      } else {
        const custPayload = { phone, name: phone, mac_address: macAddress, plan_id: selected.id, status: 'active' }
        if (ispId) custPayload.user_id = ispId
        const { data: newCust } = await supabase
          .from('customers')
          .insert(custPayload)
          .select('id')
          .single()
        customerId = newCust.id
      }

      // 2. Create payment record (status: pending)
      const payPayload = {
        customer_id: customerId,
        plan_id: selected.id,
        amount: selected.price,
        method: 'cash',  // can be extended to M-Pesa
        status: 'pending',
        reference: `WEB-${Date.now()}`,
      }
      if (ispId) payPayload.user_id = ispId
      const { data: pay } = await supabase
        .from('payments')
        .insert(payPayload)
        .select()
        .single()

      setPayment(pay)

      // 3. Create hotspot session entry
      const expiresAt = new Date(Date.now() + selected.duration_hours * 3600 * 1000).toISOString()
      const sessionPayload = {
        customer_id: customerId,
        plan_id: selected.id,
        mac_address: macAddress,
        ip_address: clientIp,
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
        status: 'pending',
      }
      if (ispId) sessionPayload.user_id = ispId
      const { data: session } = await supabase
        .from('hotspot_sessions')
        .insert(sessionPayload)
        .select()
        .single()

      // 4. Trigger Edge Function for MikroTik login
      //    This fires immediately and MikroTik API logs the user in < 1 sec
      await supabase.functions.invoke('mikrotik-trigger', {
        body: {
          sessionId: session.id,
          paymentId: pay.id,
          customerId,
          macAddress,
          ipAddress: clientIp,
          planName: selected.name,
          duration: selected.duration_hours,
          userId: ispId,
        }
      })

      setStep('connecting')

      // 5. Poll for session status (max 30 seconds)
      let elapsed = 0
      setCountdown(30)
      pollRef.current = setInterval(async () => {
        elapsed += 1
        setCountdown(30 - elapsed)

        const { data: updatedSession } = await supabase
          .from('hotspot_sessions')
          .select('status')
          .eq('id', session.id)
          .single()

        if (updatedSession?.status === 'active') {
          clearInterval(pollRef.current)
          // Update payment to confirmed
          await supabase.from('payments').update({ status: 'confirmed' }).eq('id', pay.id)
          setStep('success')

          // Redirect to original URL after 3 seconds
          if (linkOrig) {
            setTimeout(() => { window.location.href = linkOrig }, 3000)
          }
        }

        if (elapsed >= 30) {
          clearInterval(pollRef.current)
          setStep('error')
          setErrorMsg('Connection timed out. Please try again or contact support.')
        }
      }, 1000)

    } catch (err) {
      console.error(err)
      setStep('error')
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="portal-bg">
      <div className="portal-card">
        {/* Logo */}
        <div className="portal-logo">
          <div className="portal-logo-icon">
            <Wifi size={32} color="#fff" />
          </div>
          <h1>{localStorage.getItem('biz-name') || 'Vertex Billing'}</h1>
          <p>Connect to the internet</p>
          {macAddress && (
            <p style={{ fontSize: 11, color: '#555', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {macAddress}
            </p>
          )}
        </div>

        {/* ── STEP: Plans ─────────────────────────────────────── */}
        {step === 'plans' && (
          <>
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 12, textAlign: 'center' }}>
              Choose a plan to get connected
            </p>

            <div className="portal-plans-grid">
              {plans.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#8b949e', padding: '24px 0', fontSize: 13 }}>
                  Loading plans…
                </div>
              ) : plans.map(plan => (
                <div
                  key={plan.id}
                  className={`portal-plan ${selected?.id === plan.id ? 'selected' : ''}`}
                  onClick={() => setSelected(plan)}
                  id={`plan-${plan.id}`}
                >
                  <div className="portal-plan-info">
                    <h3>{plan.name}</h3>
                    <p>
                      {formatDuration(plan.duration_hours)}
                      {plan.speed_down_kbps ? ` • ${formatSpeed(plan.speed_down_kbps)}` : ''}
                      {plan.data_cap_mb ? ` • ${plan.data_cap_mb >= 1024 ? `${(plan.data_cap_mb/1024).toFixed(0)}GB` : `${plan.data_cap_mb}MB`}` : ' • Unlimited data'}
                    </p>
                    {plan.description && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{plan.description}</p>}
                  </div>
                  <div className="portal-plan-price">
                    <div className="amount">KSH {Number(plan.price).toLocaleString()}</div>
                    <div className="duration">{formatDuration(plan.duration_hours)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Phone input */}
            {selected && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#8b949e', display: 'block', marginBottom: 6 }}>
                  Your Phone Number
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px' }}>
                  <Phone size={14} color="#6b7280" />
                  <input
                    id="input-portal-phone"
                    type="tel"
                    placeholder="0712 345 678"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#e6edf3', fontSize: 14, width: '100%', outline: 'none' }}
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#ef4444' }}>
                <AlertCircle size={13} /> {errorMsg}
              </div>
            )}

            <button
              id="btn-portal-pay"
              className="portal-pay-btn"
              onClick={handlePay}
              disabled={!selected || !phone.trim()}
            >
              <Wifi size={16} />
              {selected
                ? `Connect for KSH ${Number(selected.price).toLocaleString()}`
                : 'Select a plan to continue'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#555', marginTop: 14 }}>
              Payment is verified and you'll be connected instantly
            </p>
          </>
        )}

        {/* ── STEP: Paying ───────────────────────────────────── */}
        {step === 'paying' && (
          <div className="portal-connecting">
            <div className="spinner" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3', marginBottom: 8 }}>Processing Payment…</p>
              <p style={{ fontSize: 13, color: '#8b949e' }}>Setting up your session</p>
            </div>
          </div>
        )}

        {/* ── STEP: Connecting ───────────────────────────────── */}
        {step === 'connecting' && (
          <div className="portal-connecting">
            <div className="spinner" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3', marginBottom: 8 }}>Connecting you…</p>
              <p style={{ fontSize: 13, color: '#8b949e' }}>Almost there! ({countdown}s)</p>
              <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
                Plan: <strong style={{ color: 'var(--teal-400)' }}>{selected?.name}</strong>
              </p>
            </div>
          </div>
        )}

        {/* ── STEP: Success ──────────────────────────────────── */}
        {step === 'success' && (
          <div className="portal-success">
            <div className="portal-success-icon">
              <CheckCircle size={36} color="#10b981" />
            </div>
            <h2>You're Connected! 🎉</h2>
            <p style={{ marginBottom: 8 }}>
              <strong style={{ color: 'var(--teal-400)' }}>{selected?.name}</strong> plan activated
            </p>
            <p>Expires in <strong style={{ color: '#e6edf3' }}>{selected ? formatDuration(selected.duration_hours) : ''}</strong></p>
            {linkOrig && (
              <p style={{ marginTop: 16, fontSize: 12, color: '#555' }}>
                Redirecting you to your destination…
              </p>
            )}
            <div style={{
              marginTop: 20,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              color: '#10b981',
            }}>
              ✓ Connected via MikroTik Hotspot
            </div>
          </div>
        )}

        {/* ── STEP: Error ────────────────────────────────────── */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)', border: '2px solid #ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <AlertCircle size={28} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3', marginBottom: 8 }}>Connection Failed</h2>
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 20 }}>{errorMsg}</p>
            <button className="portal-pay-btn" onClick={() => { setStep('plans'); setErrorMsg('') }}>
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={{ marginTop: 20, fontSize: 11, color: '#3d4451', textAlign: 'center' }}>
        Powered by Vertex Billing System
      </p>
    </div>
  )
}
