import React, { useState, useEffect } from 'react'
import { UserPlus, Search, Edit2, Trash2, RefreshCw, Download } from 'lucide-react'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'

const STATUS_BADGE = {
  active:   'badge badge-green',
  expired:  'badge badge-red',
  expiring: 'badge badge-yellow',
  suspended:'badge badge-gray',
}

const EMPTY_FORM = {
  name: '', phone: '', email: '', plan_id: '', mac_address: '', status: 'active'
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [plans, setPlans] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('customers').select('*, plans(name, price)').order('created_at', { ascending: false }),
      supabase.from('plans').select('id, name, price, type').order('name'),
    ])
    setCustomers(c || [])
    setPlans(p || [])
    setLoading(false)
  }

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  function openEdit(c) {
    setEditId(c.id)
    setForm({ name: c.name, phone: c.phone, email: c.email || '', plan_id: c.plan_id || '', mac_address: c.mac_address || '', status: c.status })
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editId) {
        await supabase.from('customers').update(form).eq('id', editId)
      } else {
        await supabase.from('customers').insert(form)
      }
      setModal(false)
      fetchAll()
    } catch (err) {
      alert('Error saving customer: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await supabase.from('customers').delete().eq('id', id)
    setDeleteConfirm(null)
    fetchAll()
  }

  const exportCsv = () => {
    const rows = [['Name','Phone','Email','Plan','Status','MAC']]
    filtered.forEach(c => rows.push([c.name, c.phone, c.email, c.plans?.name, c.status, c.mac_address]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'customers.csv'
    a.click()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} total customers registered</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={exportCsv}>
            <Download size={13} /> Export CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchAll}>
            <RefreshCw size={13} />
          </button>
          <button className="btn btn-primary" onClick={openAdd} id="btn-add-customer">
            <UserPlus size={14} /> Add Customer
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-toolbar-title">All Customers</span>
          <div className="search-input">
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              id="input-search-customers"
              placeholder="Search name, phone or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Plan</th>
              <th>MAC Address</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No customers found</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>
                </td>
                <td>{c.phone}</td>
                <td>
                  {c.plans ? (
                    <span className="badge badge-teal">{c.plans.name}</span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{c.mac_address || '—'}</code></td>
                <td>
                  <span className={STATUS_BADGE[c.status] || 'badge badge-gray'}>
                    <span className={`status-dot ${c.status === 'active' ? 'online' : 'offline'}`} />
                    {c.status}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(c)} title="Edit">
                      <Edit2 size={12} />
                    </button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => setDeleteConfirm(c)} title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="table-footer">
          <span>Showing {filtered.length} of {customers.length} customers</span>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Edit Customer' : 'Add New Customer'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-customer">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Customer'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" placeholder="John Doe" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input className="form-input" placeholder="0712345678" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" placeholder="john@email.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Plan</label>
            <select className="form-select" value={form.plan_id} onChange={e => setForm({...form, plan_id: e.target.value})}>
              <option value="">Select plan</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} – KSH {p.price}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="active">Active</option>
              <option value="expiring">Expiring</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">MAC Address</label>
          <input className="form-input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="AA:BB:CC:DD:EE:FF" value={form.mac_address} onChange={e => setForm({...form, mac_address: e.target.value})} />
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Customer"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm?.id)}>Delete</button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm?.name}</strong>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
