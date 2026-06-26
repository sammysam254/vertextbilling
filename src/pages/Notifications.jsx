import React, { useState, useEffect } from 'react'
import { Bell, Check, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TYPE_ICONS = {
  info:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  success: { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
}

export default function Notifications() {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifs()
    const ch = supabase
      .channel('notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, fetchNotifs)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function fetchNotifs() {
    setLoading(true)
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
    setNotifs(data || [])
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('read', false)
    fetchNotifs()
  }

  async function deleteNotif(id) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const unread = notifs.filter(n => !n.read).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unread} unread</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {unread > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={markAllRead}><Check size={13} /> Mark all read</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={fetchNotifs}><RefreshCw size={13} /></button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading…</p></div>
      ) : notifs.length === 0 ? (
        <div className="empty-state"><Bell /><p>No notifications</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifs.map(n => {
            const t = TYPE_ICONS[n.type] || TYPE_ICONS.info
            return (
              <div key={n.id} style={{
                background: n.read ? 'var(--bg-card)' : 'var(--bg-elevated)',
                border: `1px solid ${n.read ? 'var(--border-subtle)' : 'var(--border-medium)'}`,
                borderLeft: `3px solid ${t.color}`,
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: t.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Bell size={14} color={t.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)', marginBottom: 4 }}>{n.message}</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                  </span>
                </div>
                {!n.read && (
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => markRead(n.id)} title="Mark read"><Check size={11} /></button>
                )}
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteNotif(n.id)} title="Delete"><Trash2 size={11} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
