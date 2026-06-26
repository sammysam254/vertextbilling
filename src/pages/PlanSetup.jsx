import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Clock, Zap, Database, RefreshCw } from 'lucide-react'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'

const EMPTY_FORM = {
  name: '', price: '', duration_hours: '', speed_up_kbps: '',
  speed_down_kbps: '', data_cap_mb: '', type: 'hotspot', description: ''
}

export default function PlanSetup() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => { fetchPlans() }, [])

  async function fetchPlans() {
    setLoading(true)
    const { data } = await supabase.from('plans').select('*').order('price', { ascending: true })
    setPlans(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  function openEdit(p) {
    setEditId(p.id)
    setForm({
      name: p.name, price: p.price?.toString(), duration_hours: p.duration_hours?.toString(),
      speed_up_kbps: p.speed_up_kbps?.toString() || '', speed_down_kbps: p.speed_down_kbps?.toString() || '',
      data_cap_mb: p.data_cap_mb?.toString() || '', type: p.type || 'hotspot', description: p.description || ''
    })
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        price: Number(form.price),
        duration_hours: Number(form.duration_hours),
        speed_up_kbps: form.speed_up_kbps ? Number(form.speed_up_kbps) : null,
        speed_down_kbps: form.speed_down_kbps ? Number(form.speed_down_kbps) : null,
        data_cap_mb: form.data_cap_mb ? Number(form.data_cap_mb) : null,
        type: form.type,
        description: form.description,
      }
      if (editId) {
        await supabase.from('plans').update(payload).eq('id', editId)
      } else {
        await supabase.from('plans').insert(payload)
      }
      setModal(false)
      fetchPlans()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    await supabase.from('plans').delete().eq('id', id)
    setDeleteConfirm(null)
    fetchPlans()
  }

  const filtered = typeFilter === 'all' ? plans : plans.filter(p => p.type === typeFilter)

  function formatDuration(h) {
    if (!h) return '—'
    if (h < 24) return `${h}h`
    const days = Math.floor(h / 24)
    return `${days} day${days !== 1 ? 's' : ''}`
  }

  function formatSpeed(kbps) {
    if (!kbps) return 'Unlimited'
    if (kbps >= 1000) return `${(kbps / 1000).toFixed(0)} Mbps`
    return `${kbps} Kbps`
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Plan Setup</h1>
          <p className="page-subtitle">Configure hotspot and PPPoE plans</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchPlans}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={openAdd} id="btn-add-plan">
            <Plus size={14} /> Add Plan
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all','hotspot','pppoe'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            style={{
              padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: typeFilter === t ? 'var(--teal-600)' : 'var(--bg-elevated)',
              color: typeFilter === t ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {t === 'all' ? 'All Plans' : t === 'hotspot' ? '📶 Hotspot' : '🔌 PPPoE'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading plans…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Zap />
          <p>No plans yet. Create your first plan to get started.</p>
          <button className="btn btn-primary" onClick={openAdd}>Add Plan</button>
        </div>
      ) : (
        <div className="plans-grid">
          {filtered.map(plan => (
            <div key={plan.id} className="plan-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span className="plan-card-name">{plan.name}</span>
                <span className={`badge ${plan.type === 'hotspot' ? 'badge-teal' : 'badge-blue'}`}>
                  {plan.type}
                </span>
              </div>
              <div className="plan-card-price">
                KSH {Number(plan.price || 0).toLocaleString()}
                <span> / {formatDuration(plan.duration_hours)}</span>
              </div>
              {plan.description && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{plan.description}</p>
              )}
              <div className="plan-card-details">
                <div className="plan-card-detail">
                  <Clock />
                  <span>Duration: {formatDuration(plan.duration_hours)}</span>
                </div>
                <div className="plan-card-detail">
                  <Zap />
                  <span>Up: {formatSpeed(plan.speed_up_kbps)} / Down: {formatSpeed(plan.speed_down_kbps)}</span>
                </div>
                {plan.data_cap_mb && (
                  <div className="plan-card-detail">
                    <Database />
                    <span>Data cap: {plan.data_cap_mb >= 1024 ? `${(plan.data_cap_mb/1024).toFixed(1)} GB` : `${plan.data_cap_mb} MB`}</span>
                  </div>
                )}
              </div>
              <div className="plan-card-actions">
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEdit(plan)}>
                  <Edit2 size={12} /> Edit
                </button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteConfirm(plan)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editId ? 'Edit Plan' : 'Add New Plan'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Plan'}</button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Plan Name *</label>
            <input className="form-input" placeholder="Daily 1GB" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="hotspot">Hotspot</option>
              <option value="pppoe">PPPoE</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Price (KSH) *</label>
            <input className="form-input" type="number" placeholder="50" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Duration (Hours) *</label>
            <input className="form-input" type="number" placeholder="24" value={form.duration_hours} onChange={e => setForm({...form, duration_hours: e.target.value})} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Upload Speed (Kbps)</label>
            <input className="form-input" type="number" placeholder="2048 (2 Mbps)" value={form.speed_up_kbps} onChange={e => setForm({...form, speed_up_kbps: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Download Speed (Kbps)</label>
            <input className="form-input" type="number" placeholder="5120 (5 Mbps)" value={form.speed_down_kbps} onChange={e => setForm({...form, speed_down_kbps: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Data Cap (MB) – leave blank for unlimited</label>
          <input className="form-input" type="number" placeholder="1024 (1 GB)" value={form.data_cap_mb} onChange={e => setForm({...form, data_cap_mb: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" placeholder="Brief plan description for captive portal" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Plan" size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm?.id)}>Delete Plan</button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Delete plan <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm?.name}</strong>?
          Existing customers on this plan will be unaffected but cannot renew.
        </p>
      </Modal>
    </div>
  )
}
