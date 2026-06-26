import React, { useState, useEffect } from 'react'
import { Plus, Search, Download, RefreshCw } from 'lucide-react'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'

const fmt = (n) => n ? `KSH ${Number(n).toLocaleString()}` : '—'

const STATUS_BADGE = {
  confirmed: 'badge badge-green',
  pending:   'badge badge-yellow',
  failed:    'badge badge-red',
}

const EMPTY_FORM = { customer_id: '', plan_id: '', amount: '', method: 'cash', reference: '', status: 'confirmed' }

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [customers, setCustomers] = useState([])
  const [plans, setPlans] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: p }, { data: c }, { data: pl }] = await Promise.all([
      supabase.from('payments').select('*, customers(name, phone), plans(name)').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name, phone'),
      supabase.from('plans').select('id, name, price'),
    ])
    setPayments(p || [])
    setCustomers(c || [])
    setPlans(pl || [])
    setLoading(false)
  }

  const filtered = payments.filter(p =>
    p.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.reference?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave() {
    setSaving(true)
    try {
      await supabase.from('payments').insert({ ...form, amount: Number(form.amount) })
      // If plan selected and confirmed, update customer status
      if (form.status === 'confirmed' && form.plan_id) {
        const plan = plans.find(pl => pl.id === form.plan_id)
        if (plan) {
          await supabase.from('customers').update({ plan_id: form.plan_id, status: 'active' }).eq('id', form.customer_id)
        }
      }
      setModal(false)
      setForm(EMPTY_FORM)
      fetchAll()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  const totalRevenue = filtered.filter(p => p.status === 'confirmed').reduce((s, p) => s + (p.amount || 0), 0)

  const exportCsv = () => {
    const rows = [['Customer','Phone','Plan','Amount','Method','Reference','Status','Date']]
    filtered.forEach(p => rows.push([
      p.customers?.name, p.customers?.phone, p.plans?.name,
      p.amount, p.method, p.reference, p.status,
      p.created_at ? new Date(p.created_at).toLocaleDateString() : ''
    ]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'payments.csv'
    a.click()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Total confirmed: {fmt(totalRevenue)}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={exportCsv}><Download size={13} /> Export</button>
          <button className="btn btn-secondary btn-sm" onClick={fetchAll}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={() => setModal(true)} id="btn-add-payment">
            <Plus size={14} /> Record Payment
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-toolbar-title">Payment History</span>
          <div className="search-input">
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input id="input-search-payments" placeholder="Search customer or reference…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Customer</th><th>Plan</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.customers?.name || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.customers?.phone}</div>
                </td>
                <td>{p.plans?.name ? <span className="badge badge-teal">{p.plans.name}</span> : '—'}</td>
                <td style={{ fontWeight: 700, color: 'var(--teal-400)' }}>{fmt(p.amount)}</td>
                <td style={{ textTransform: 'capitalize' }}>{p.method || '—'}</td>
                <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{p.reference || '—'}</code></td>
                <td><span className={STATUS_BADGE[p.status] || 'badge badge-gray'}>{p.status}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer"><span>{filtered.length} payments</span></div>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Record Payment"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Customer *</label>
          <select className="form-select" value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})}>
            <option value="">Select customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} – {c.phone}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Plan</label>
            <select className="form-select" value={form.plan_id} onChange={e => {
              const plan = plans.find(p => p.id === e.target.value)
              setForm({...form, plan_id: e.target.value, amount: plan?.price?.toString() || form.amount})
            }}>
              <option value="">Select plan</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} – KSH {p.price}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (KSH) *</label>
            <input className="form-input" type="number" placeholder="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Method</label>
            <select className="form-select" value={form.method} onChange={e => setForm({...form, method: e.target.value})}>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank Transfer</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Reference / Receipt No.</label>
          <input className="form-input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="MPesa code or receipt number" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} />
        </div>
      </Modal>
    </div>
  )
}
