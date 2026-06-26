import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wifi, Eye, EyeOff, Lock, Mail, User, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'

  // Shared fields
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)

  // Sign-up only
  const [fullName, setFullName]         = useState('')
  const [confirmPw, setConfirmPw]       = useState('')
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  // ── SIGN IN ──────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally { setLoading(false) }
  }

  // ── SIGN UP ──────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (password !== confirmPw) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        }
      })
      if (err) throw err
      setSuccess('Account created! Check your email to confirm, then sign in.')
      // Switch to sign in after a moment
      setTimeout(() => {
        setMode('signin')
        setSuccess('')
        setPassword('')
        setFullName('')
        setConfirmPw('')
      }, 3500)
    } catch (err) {
      setError(err.message || 'Sign up failed. Try again.')
    } finally { setLoading(false) }
  }

  // ── STYLES ───────────────────────────────────────────────────
  const inputWrap = {
    position: 'relative', display: 'flex', alignItems: 'center',
  }
  const iconStyle = {
    position: 'absolute', left: 12, color: '#6b7280', pointerEvents: 'none', flexShrink: 0,
  }
  const inputStyle = {
    paddingLeft: 36, width: '100%',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1117 0%, #0f2027 60%, #0d1117 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', position: 'relative', overflowY: 'auto',
    }}>
      {/* Glow orbs */}
      <div style={{
        position: 'absolute', top: -150, left: -150, width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,184,144,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -150, right: -100, width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: 'rgba(22,27,34,0.9)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '40px 36px',
        width: '100%', maxWidth: 430,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        position: 'relative', zIndex: 1,
        animation: 'slideUp 0.3s ease',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 18,
            background: 'linear-gradient(135deg, var(--teal-500), var(--teal-700))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 32px rgba(0,184,144,0.35)',
          }}>
            <Wifi size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Vertex Billing
          </h1>
          <p style={{ fontSize: 13, color: '#8b949e' }}>Hotspot Billing & Management</p>
        </div>

        {/* Mode toggle tabs */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: 4, marginBottom: 24,
        }}>
          {['signin', 'signup'].map(m => (
            <button
              key={m}
              id={`btn-tab-${m}`}
              onClick={() => { setMode(m); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all 0.2s ease',
                background: mode === m
                  ? 'linear-gradient(135deg, var(--teal-500), var(--teal-600))'
                  : 'transparent',
                color: mode === m ? '#fff' : '#8b949e',
                boxShadow: mode === m ? '0 2px 8px rgba(0,184,144,0.3)' : 'none',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* ── SIGN IN FORM ── */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={inputWrap}>
                <Mail size={14} style={iconStyle} />
                <input id="input-email" type="email" className="form-input"
                  style={inputStyle} placeholder="admin@vertexbilling.co.ke"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={inputWrap}>
                <Lock size={14} style={iconStyle} />
                <input id="input-password"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  style={{ ...inputStyle, paddingRight: 40 }}
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: 'absolute', right: 12, background: 'none',
                  border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0,
                }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error   && <Alert type="error"   msg={error} />}
            {success && <Alert type="success" msg={success} />}

            <SubmitBtn loading={loading} label="Sign In" loadingLabel="Signing in…" />

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#6b7280' }}>
              Don't have an account?{' '}
              <button type="button" onClick={() => { setMode('signup'); setError('') }}
                style={{ background: 'none', border: 'none', color: 'var(--teal-400)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                Create one →
              </button>
            </p>
          </form>
        )}

        {/* ── SIGN UP FORM ── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={inputWrap}>
                <User size={14} style={iconStyle} />
                <input id="input-fullname" type="text" className="form-input"
                  style={inputStyle} placeholder="John Doe"
                  value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={inputWrap}>
                <Mail size={14} style={iconStyle} />
                <input id="input-signup-email" type="email" className="form-input"
                  style={inputStyle} placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={inputWrap}>
                  <Lock size={14} style={iconStyle} />
                  <input id="input-signup-password"
                    type={showPw ? 'text' : 'password'}
                    className="form-input"
                    style={{ ...inputStyle, paddingRight: 36 }}
                    placeholder="Min 6 chars"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{
                    position: 'absolute', right: 10, background: 'none',
                    border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0,
                  }}>
                    {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div style={inputWrap}>
                  <Lock size={14} style={iconStyle} />
                  <input id="input-confirm-password"
                    type={showConfirmPw ? 'text' : 'password'}
                    className="form-input"
                    style={{ ...inputStyle, paddingRight: 36 }}
                    placeholder="Repeat password"
                    value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{
                    position: 'absolute', right: 10, background: 'none',
                    border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0,
                  }}>
                    {showConfirmPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password strength hint */}
            {password && (
              <div style={{ marginBottom: 12, display: 'flex', gap: 4 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: password.length >= i * 3
                      ? (password.length < 6 ? '#f59e0b' : password.length < 10 ? 'var(--teal-500)' : '#10b981')
                      : 'rgba(255,255,255,0.08)',
                    transition: 'background 0.2s',
                  }} />
                ))}
                <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6, whiteSpace: 'nowrap' }}>
                  {password.length < 6 ? 'Too short' : password.length < 10 ? 'Good' : 'Strong'}
                </span>
              </div>
            )}

            {error   && <Alert type="error"   msg={error} />}
            {success && <Alert type="success" msg={success} />}

            <SubmitBtn loading={loading} label="Create Account" loadingLabel="Creating account…" />

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#6b7280' }}>
              Already have an account?{' '}
              <button type="button" onClick={() => { setMode('signin'); setError('') }}
                style={{ background: 'none', border: 'none', color: 'var(--teal-400)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                Sign in →
              </button>
            </p>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#444d56' }}>
          Vertex Billing v1.0 • Powered by Supabase
        </p>
      </div>
    </div>
  )
}

// ── Small shared components ──────────────────────────────────────

function Alert({ type, msg }) {
  const styles = {
    error:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   color: '#ef4444' },
    success: { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  color: '#10b981' },
  }
  const s = styles[type]
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 8, padding: '10px 12px', marginBottom: 14,
      color: s.color, fontSize: 12, lineHeight: 1.5,
    }}>
      {msg}
    </div>
  )
}

function SubmitBtn({ loading, label, loadingLabel }) {
  return (
    <button id="btn-submit" type="submit" disabled={loading} style={{
      width: '100%', padding: 13, borderRadius: 10,
      fontSize: 14, fontWeight: 700,
      background: 'linear-gradient(135deg, var(--teal-500), var(--teal-600))',
      color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1,
      boxShadow: '0 4px 20px rgba(0,184,144,0.3)',
      transition: 'all 0.2s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginTop: 4,
    }}>
      {loading ? loadingLabel : (
        <>{label} <ArrowRight size={14} /></>
      )}
    </button>
  )
}
