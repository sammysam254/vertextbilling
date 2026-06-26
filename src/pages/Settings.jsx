import React, { useState } from 'react'
import { Save, Globe, Palette } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export default function Settings() {
  const { theme, toggleTheme } = useTheme()
  const [form, setForm] = useState({
    businessName: localStorage.getItem('biz-name') || 'Vertex Billing',
    portalUrl: localStorage.getItem('portal-url') || 'http://192.168.88.1:3000',
    currency: localStorage.getItem('currency') || 'KSH',
    timezone: localStorage.getItem('timezone') || 'Africa/Nairobi',
    smsEnabled: localStorage.getItem('sms-enabled') === 'true',
    emailEnabled: localStorage.getItem('email-enabled') === 'true',
  })
  const [saved, setSaved] = useState(false)

  function handleSave() {
    localStorage.setItem('biz-name', form.businessName)
    localStorage.setItem('portal-url', form.portalUrl)
    localStorage.setItem('currency', form.currency)
    localStorage.setItem('timezone', form.timezone)
    localStorage.setItem('sms-enabled', form.smsEnabled)
    localStorage.setItem('email-enabled', form.emailEnabled)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Section = ({ title, children }) => (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )

  const SettingRow = ({ label, desc, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ marginLeft: 20 }}>{children}</div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} id="btn-save-settings">
          <Save size={14} /> {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Appearance */}
      <Section title="🎨 Appearance">
        <SettingRow label="Theme" desc="Switch between dark and light mode">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
            <label className="toggle">
              <input type="checkbox" checked={theme === 'light'} onChange={toggleTheme} id="toggle-theme" />
              <span className="toggle-slider" />
            </label>
          </div>
        </SettingRow>
      </Section>

      {/* Business */}
      <Section title="🏢 Business">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input className="form-input" value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select className="form-select" value={form.currency} onChange={e => setForm({...form, currency: e.target.value})}>
              <option value="KSH">KSH – Kenyan Shilling</option>
              <option value="USD">USD – US Dollar</option>
              <option value="TZS">TZS – Tanzanian Shilling</option>
              <option value="UGX">UGX – Ugandan Shilling</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Timezone</label>
            <select className="form-select" value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})}>
              <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
              <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Portal URL</label>
            <input className="form-input" value={form.portalUrl} onChange={e => setForm({...form, portalUrl: e.target.value})} />
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="🔔 Notifications">
        <SettingRow label="SMS Notifications" desc="Send SMS to customers on expiry">
          <label className="toggle">
            <input type="checkbox" checked={form.smsEnabled} onChange={e => setForm({...form, smsEnabled: e.target.checked})} />
            <span className="toggle-slider" />
          </label>
        </SettingRow>
        <SettingRow label="Email Notifications" desc="Send email receipts">
          <label className="toggle">
            <input type="checkbox" checked={form.emailEnabled} onChange={e => setForm({...form, emailEnabled: e.target.checked})} />
            <span className="toggle-slider" />
          </label>
        </SettingRow>
      </Section>

      {/* Supabase info */}
      <Section title="🗄️ Database">
        <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 14, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--teal-300)', lineHeight: 1.7 }}>
          <div>URL: {import.meta.env.VITE_SUPABASE_URL || 'Not configured'}</div>
          <div style={{ color: 'var(--text-muted)' }}>Set credentials in your .env file</div>
        </div>
      </Section>
    </div>
  )
}
