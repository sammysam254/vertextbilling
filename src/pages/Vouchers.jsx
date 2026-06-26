import React, { useState, useEffect } from 'react'
import { Plus, Copy, RefreshCw, Printer, Ticket } from 'lucide-react'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function Vouchers() {
  const [vouchers, setVouchers] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ plan_id: '', quantity: 10 })
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: v }, { data: p }] = await Promise.all([
      supabase.from('vouchers').select('*, plans(name, price, duration_hours)').order('created_at', { ascending: false }),
      supabase.from('plans').select('id, name, price, type').eq('type', 'hotspot'),
    ])
    setVouchers(v || [])
    setPlans(p || [])
    setLoading(false)
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const codes = Array.from({ length: Number(form.quantity) }, () => ({
        plan_id: form.plan_id,
        code: genCode(),
      }))
      await supabase.from('vouchers').insert(codes)
      setModal(false)
      fetchAll()
    } catch (err) { alert(err.message) }
    finally { setGenerating(false) }
  }

  const filtered = filter === 'all' ? vouchers
    : filter === 'used' ? vouchers.filter(v => v.used_at)
    : vouchers.filter(v => !v.used_at)

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
  }

  const printVouchers = () => {
    const unused = filtered.filter(v => !v.used_at)
    const html = `
      <html><head><title>WiFi Vouchers</title><style>
        body { font-family: sans-serif; }
        .voucher { display: inline-block; border: 2px dashed #ccc; border-radius: 8px; padding: 12px 16px; margin: 8px; text-align: center; width: 160px; }
        .code { font-size: 20px; font-weight: bold; letter-spacing: 2px; font-family: monospace; }
        .plan { font-size: 11px; color: #666; margin-top: 4px; }
      </style></head><body>
        ${unused.map(v => `<div class="voucher"><div class="code">${v.code}</div><div class="plan">${v.plans?.name || ''} – KSH ${v.plans?.price || ''}</div></div>`).join('')}
      </body></html>
    `
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.print()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vouchers</h1>
          <p className="page-subtitle">{vouchers.filter(v => !v.used_at).length} unused of {vouchers.length} total</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={printVouchers}><Printer size={13} /> Print</button>
          <button className="btn btn-secondary btn-sm" onClick={fetchAll}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={() => setModal(true)} id="btn-generate-vouchers">
            <Plus size={14} /> Generate Vouchers
          </button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'unused', 'used'].map(f => (
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
        <table>
          <thead>
            <tr>
              <th>Code</th><th>Plan</th><th>Price</th><th>Duration</th><th>Status</th><th>Used At</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><Ticket /><p>No vouchers</p></div></td></tr>
            ) : filtered.map(v => (
              <tr key={v.id}>
                <td>
                  <code style={{
                    fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                    letterSpacing: '0.1em', color: v.used_at ? 'var(--text-muted)' : 'var(--teal-400)',
                  }}>{v.code}</code>
                </td>
                <td>{v.plans?.name ? <span className="badge badge-teal">{v.plans.name}</span> : '—'}</td>
                <td style={{ fontWeight: 600 }}>{v.plans?.price ? `KSH ${v.plans.price}` : '—'}</td>
                <td>{v.plans?.duration_hours ? `${v.plans.duration_hours}h` : '—'}</td>
                <td>
                  <span className={v.used_at ? 'badge badge-gray' : 'badge badge-green'}>
                    {v.used_at ? 'Used' : 'Available'}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {v.used_at ? new Date(v.used_at).toLocaleDateString() : '—'}
                </td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyCode(v.code)}
                    disabled={!!v.used_at}
                  >
                    <Copy size={11} /> Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer"><span>{filtered.length} vouchers</span></div>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Generate Vouchers"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !form.plan_id}>
              {generating ? 'Generating…' : `Generate ${form.quantity} Vouchers`}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Plan *</label>
          <select className="form-select" value={form.plan_id} onChange={e => setForm({...form, plan_id: e.target.value})}>
            <option value="">Select hotspot plan</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} – KSH {p.price}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Quantity</label>
          <input className="form-input" type="number" min={1} max={500} value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Voucher codes are 8-character alphanumeric codes that clients can use to authenticate on the captive portal.
        </p>
      </Modal>
    </div>
  )
}
