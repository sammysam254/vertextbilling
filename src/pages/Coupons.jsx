import React, { useState, useEffect } from 'react'
import { Plus, Tag, Trash2, Copy } from 'lucide-react'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'

function genCoupon() {
  return 'WIFI-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function Coupons() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ code: genCoupon(), discount_type: 'percent', discount_value: '', max_uses: 1, description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchCoupons() }, [])

  async function fetchCoupons() {
    setLoading(true)
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons(data || [])
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await supabase.from('coupons').insert({ ...form, discount_value: Number(form.discount_value), max_uses: Number(form.max_uses) })
      setModal(false)
      setForm({ code: genCoupon(), discount_type: 'percent', discount_value: '', max_uses: 1, description: '' })
      fetchCoupons()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    await supabase.from('coupons').delete().eq('id', id)
    fetchCoupons()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Coupons</h1>
          <p className="page-subtitle">Discount coupons for customers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)} id="btn-add-coupon">
          <Plus size={14} /> Create Coupon
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading…</p></div>
      ) : coupons.length === 0 ? (
        <div className="empty-state"><Tag /><p>No coupons yet</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {coupons.map(c => (
            <div key={c.id} style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border-medium)',
              borderRadius: 12,
              padding: 18,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, right: 0,
                background: c.discount_type === 'percent' ? 'rgba(0,184,144,0.1)' : 'rgba(59,130,246,0.1)',
                padding: '4px 12px',
                borderBottomLeftRadius: 8,
                fontSize: 11, fontWeight: 700,
                color: c.discount_type === 'percent' ? 'var(--teal-400)' : '#3b82f6',
              }}>
                {c.discount_type === 'percent' ? `${c.discount_value}% OFF` : `KSH ${c.discount_value} OFF`}
              </div>

              <code style={{
                fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800,
                letterSpacing: '0.1em', color: 'var(--text-primary)', display: 'block', marginBottom: 8
              }}>{c.code}</code>

              {c.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{c.description}</p>}

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Used: {c.used_count || 0} / {c.max_uses} times
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => navigator.clipboard.writeText(c.code)}>
                  <Copy size={11} /> Copy
                </button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Create Coupon"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Create Coupon'}</button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Coupon Code</label>
            <input className="form-input" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }} value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} />
          </div>
          <div className="form-group">
            <label className="form-label">Discount Type</label>
            <select className="form-select" value={form.discount_type} onChange={e => setForm({...form, discount_type: e.target.value})}>
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed Amount (KSH)</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Discount Value *</label>
            <input className="form-input" type="number" placeholder={form.discount_type === 'percent' ? '20' : '50'} value={form.discount_value} onChange={e => setForm({...form, discount_value: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Max Uses</label>
            <input className="form-input" type="number" min={1} value={form.max_uses} onChange={e => setForm({...form, max_uses: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" placeholder="e.g. Weekend promo discount" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
      </Modal>
    </div>
  )
}
