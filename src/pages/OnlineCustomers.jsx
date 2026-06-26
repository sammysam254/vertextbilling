import React, { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

function elapsed(startedAt) {
  if (!startedAt) return '—'
  const diff = Date.now() - new Date(startedAt).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function OnlineCustomers() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
    const ch = supabase
      .channel('online-customers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotspot_sessions' }, fetchSessions)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function fetchSessions() {
    setLoading(true)
    const { data } = await supabase
      .from('hotspot_sessions')
      .select('*, customers(name, phone, mac_address), plans(name)')
      .eq('status', 'active')
      .order('started_at', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  async function disconnectSession(id) {
    await supabase.from('hotspot_sessions').update({ status: 'disconnected' }).eq('id', id)
    fetchSessions()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Online Customers</h1>
          <p className="page-subtitle">{sessions.length} active session{sessions.length !== 1 ? 's' : ''} right now</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchSessions}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Live counter banner */}
      <div style={{
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: 10,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: '#10b981', fontWeight: 600 }}>Live – updates in real time via Supabase Realtime</span>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Plan</th>
              <th>IP Address</th>
              <th>MAC Address</th>
              <th>Session Start</th>
              <th>Elapsed</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <WifiOff />
                    <p>No active sessions right now</p>
                  </div>
                </td>
              </tr>
            ) : sessions.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="status-dot online" />
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.customers?.name || s.mac_address}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.customers?.phone}</div>
                    </div>
                  </div>
                </td>
                <td><span className="badge badge-teal">{s.plans?.name || '—'}</span></td>
                <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.ip_address || '—'}</code></td>
                <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.mac_address || s.customers?.mac_address || '—'}</code></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.started_at ? new Date(s.started_at).toLocaleTimeString() : '—'}
                </td>
                <td><span className="badge badge-green">{elapsed(s.started_at)}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.expires_at ? new Date(s.expires_at).toLocaleString() : '—'}
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => disconnectSession(s.id)}
                    title="Disconnect"
                  >
                    <LogOut size={12} /> Kick
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer">
          <span>{sessions.length} active sessions</span>
        </div>
      </div>
    </div>
  )
}
