import React, { useState, useEffect } from 'react'
import { Search, Download, RefreshCw, ArrowLeftRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

const fmt = (n) => n ? `KSH ${Number(n).toLocaleString()}` : '—'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetch() }, [filter])

  async function fetch() {
    setLoading(true)
    let query = supabase
      .from('payments')
      .select('*, customers(name, phone), plans(name, type)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query
    setTransactions(data || [])
    setLoading(false)
  }

  const filtered = transactions.filter(t =>
    t.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.reference?.toLowerCase().includes(search.toLowerCase()) ||
    t.plans?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const exportCsv = () => {
    const rows = [['Date','Customer','Plan','Amount','Method','Reference','Status']]
    filtered.forEach(t => rows.push([
      t.created_at ? new Date(t.created_at).toLocaleString() : '',
      t.customers?.name, t.plans?.name, t.amount, t.method, t.reference, t.status
    ]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'transactions.csv'
    a.click()
  }

  const BADGE = { confirmed: 'badge badge-green', pending: 'badge badge-yellow', failed: 'badge badge-red' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{filtered.length} transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={exportCsv}><Download size={13} /> Export</button>
          <button className="btn btn-secondary btn-sm" onClick={fetch}><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all','confirmed','pending','failed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: filter === f ? 'var(--teal-600)' : 'var(--bg-elevated)',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowLeftRight size={15} style={{ color: 'var(--teal-400)' }} />
            <span className="table-toolbar-title">Transaction Log</span>
          </div>
          <div className="search-input">
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date & Time</th><th>Customer</th><th>Plan</th><th>Type</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding: 40, color:'var(--text-muted)' }}>Loading…</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id}>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{t.customers?.name || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.customers?.phone}</div>
                </td>
                <td>{t.plans?.name ? <span className="badge badge-teal">{t.plans.name}</span> : '—'}</td>
                <td><span className="badge badge-purple">{t.plans?.type || 'hotspot'}</span></td>
                <td style={{ fontWeight: 700, color: 'var(--teal-400)' }}>{fmt(t.amount)}</td>
                <td style={{ textTransform: 'capitalize' }}>{t.method || '—'}</td>
                <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t.reference || '—'}</code></td>
                <td><span className={BADGE[t.status] || 'badge badge-gray'}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer"><span>{filtered.length} records</span></div>
      </div>
    </div>
  )
}
