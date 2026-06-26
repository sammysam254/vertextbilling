import React, { useState, useEffect } from 'react'
import { Copy, Download, Router, RefreshCw, CheckCircle, Terminal } from 'lucide-react'
import Modal from '../components/Modal'
import {
  generateUnifiedSetupScript,
  generatePlanProfilesScript,
} from '../lib/mikrotik'
import { supabase } from '../lib/supabase'

const SCRIPTS = [
  { id: 'unified', label: '1. Unified Setup Script', desc: 'Paste this single script in Winbox to configure everything' },
  { id: 'plans',    label: '2. Sync Plans (Optional)', desc: 'Run this script to sync or update plans on the router' },
]

export default function Mikrotiks() {
  const [plans, setPlans] = useState([])
  const [activeScript, setActiveScript] = useState('unified')
  const [configId, setConfigId] = useState(null)
  const [lastSeen, setLastSeen] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [config, setConfig] = useState({
    interfaceName: 'ether2',
    hotspotGateway: '192.168.88.1',
    hotspotNetwork: '192.168.88.0/24',
    dnsServer: '8.8.8.8',
    hotspotName: 'Vertex-Hotspot',
    billingServerUrl: window.location.origin,
    apiUsername: 'billing-api',
    apiPassword: 'StrongP@ss123!',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  })

  const [modal, setModal] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchConfigAndPlans = async () => {
    setLoading(true)
    try {
      // 1. Fetch plans
      const { data: plansData } = await supabase.from('plans').select('*')
      setPlans(plansData || [])

      // 2. Fetch active MikroTik config
      const { data: configData } = await supabase
        .from('mikrotik_configs')
        .select('*')
        .eq('active', true)
        .limit(1)

      if (configData && configData.length > 0) {
        const mt = configData[0]
        setConfigId(mt.id)
        setLastSeen(mt.last_seen)
        setConfig({
          interfaceName: mt.interface_name || 'ether2',
          hotspotGateway: mt.host || '192.168.88.1',
          hotspotNetwork: mt.network_cidr || '192.168.88.0/24',
          dnsServer: mt.dns_server || '8.8.8.8',
          hotspotName: mt.name || 'Vertex-Hotspot',
          billingServerUrl: mt.billing_url || window.location.origin,
          apiUsername: mt.username || 'billing-api',
          apiPassword: mt.password || 'StrongP@ss123!',
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
          supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        })
      }
    } catch (err) {
      console.error('Error fetching MikroTik config:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfigAndPlans()

    // Poll router status every 5 seconds
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('mikrotik_configs')
        .select('last_seen')
        .eq('active', true)
        .limit(1)
      if (data && data.length > 0) {
        setLastSeen(data[0].last_seen)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [configId])

  const handleApplyConfig = async () => {
    setSaving(true)
    try {
      const payload = {
        name: config.hotspotName,
        host: config.hotspotGateway,
        port: 8728,
        username: config.apiUsername,
        password: config.apiPassword,
        api_port: 8728,
        interface_name: config.interfaceName,
        network_cidr: config.hotspotNetwork,
        dns_server: config.dnsServer,
        billing_url: config.billingServerUrl,
        active: true,
      }

      let res
      if (configId) {
        res = await supabase
          .from('mikrotik_configs')
          .update(payload)
          .eq('id', configId)
      } else {
        res = await supabase
          .from('mikrotik_configs')
          .insert(payload)
          .select('id')
      }

      if (res.error) throw res.error

      if (!configId && res.data && res.data.length > 0) {
        setConfigId(res.data[0].id)
      }

      setModal(false)
      fetchConfigAndPlans()
    } catch (err) {
      alert('Error saving config: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function getScript() {
    switch (activeScript) {
      case 'unified':  return generateUnifiedSetupScript(config, plans)
      case 'plans':    return generatePlanProfilesScript(plans)
      default:         return '# Select a script above'
    }
  }

  function copyScript() {
    const text = getScript()
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {
        fallbackCopyText(text)
      })
    } else {
      fallbackCopyText(text)
    }
  }

  function fallbackCopyText(text) {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.top = "0"
    textArea.style.left = "0"
    textArea.style.position = "fixed"
    textArea.style.opacity = "0"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Fallback copy failed', err)
    }
    document.body.removeChild(textArea)
  }

  function downloadScript() {
    const blob = new Blob([getScript()], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `vertex-${activeScript}.rsc`
    a.click()
  }

  const currentScriptInfo = SCRIPTS.find(s => s.id === activeScript)

  // Calculate online status (if checked in within 12 seconds)
  const isOnline = lastSeen ? (new Date() - new Date(lastSeen)) < 12000 : false

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">MikroTik Configuration</h1>
          <p className="page-subtitle">Configure your MikroTik router and check its connection state</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setModal(true)} id="btn-edit-mikrotik-config">
          <Router size={14} /> Edit Config
        </button>
      </div>

      {/* MikroTik Status Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: isOnline ? 'rgba(16,185,129,0.06)' : 'rgba(107,114,128,0.06)',
        border: `1px solid ${isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)'}`,
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 20,
      }}>
        <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} style={{ width: 10, height: 10 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isOnline ? '#10b981' : 'var(--text-secondary)' }}>
            MikroTik Router State: {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {lastSeen 
              ? `Last heartbeat received: ${new Date(lastSeen).toLocaleTimeString()} (${Math.round((new Date() - new Date(lastSeen)) / 1000)}s ago)`
              : 'No heartbeat received yet. Please run the setup script on your router.'
            }
          </div>
        </div>
        {isOnline && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4 }}>
            Connected
          </span>
        )}
      </div>

      {/* How to use banner */}
      <div style={{
        background: 'rgba(0,184,144,0.06)',
        border: '1px solid rgba(0,184,144,0.15)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        <Terminal size={20} style={{ color: 'var(--teal-400)', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal-300)', marginBottom: 4 }}>How to connect your router</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            1. Click <strong>Edit Config</strong> above to make sure the router interface and billing URL match your network.<br />
            2. Copy the <strong>Unified Setup Script</strong> below.<br />
            3. Open <strong>Winbox → New Terminal</strong>, paste the script, and press Enter.<br />
            4. Once run, the router will configure the network, sync your plans, and show <strong>ONLINE</strong> above within 5 seconds.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        {/* Script selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SCRIPTS.map(s => (
            <div
              key={s.id}
              onClick={() => setActiveScript(s.id)}
              style={{
                background: activeScript === s.id ? 'var(--bg-active)' : 'var(--bg-card)',
                border: `1px solid ${activeScript === s.id ? 'var(--teal-600)' : 'var(--border-subtle)'}`,
                borderRadius: 10,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: activeScript === s.id ? 'var(--teal-300)' : 'var(--text-primary)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}

          {/* Connection speed callout */}
          <div style={{
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 10,
            padding: '12px 14px',
            marginTop: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 4 }}>⚡ &lt;1 Second Connect</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The poller checks Supabase for logins. When a user pays, they connect immediately.
            </div>
          </div>
        </div>

        {/* Script display */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{currentScriptInfo?.label}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{currentScriptInfo?.desc}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={copyScript} id={`btn-copy-${activeScript}`}>
                {copied ? <CheckCircle size={12} style={{ color: 'var(--teal-400)' }} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={downloadScript}>
                <Download size={12} /> Download .rsc
              </button>
            </div>
          </div>

          <div className="code-block">
            <div className="code-block-header">
              <span style={{ fontFamily: 'var(--font-mono)' }}>vertex-{activeScript}.rsc</span>
              <span style={{ color: 'var(--teal-500)' }}>RouterOS Script</span>
            </div>
            <pre>{getScript()}</pre>
          </div>
        </div>
      </div>

      {/* Config modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="MikroTik Configuration" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Close</button>
            <button className="btn btn-primary" onClick={handleApplyConfig} disabled={saving}>
              {saving ? 'Saving...' : 'Apply & Save'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['interfaceName',    'Hotspot Interface', 'ether2'],
            ['hotspotGateway',   'Gateway IP (Router IP)', '192.168.88.1'],
            ['hotspotNetwork',   'Network CIDR',      '192.168.88.0/24'],
            ['dnsServer',        'DNS Server',        '8.8.8.8'],
            ['hotspotName',      'Hotspot Name',      'Vertex-Hotspot'],
            ['billingServerUrl', 'Billing Server URL', window.location.origin],
            ['apiUsername',      'API Username',      'billing-api'],
            ['apiPassword',      'API Password',      '••••••••'],
          ].map(([key, label, placeholder]) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input
                className="form-input"
                style={{ fontFamily: key === 'apiPassword' ? 'var(--font-mono)' : 'inherit' }}
                placeholder={placeholder}
                type={key === 'apiPassword' ? 'password' : 'text'}
                value={config[key]}
                onChange={e => setConfig({ ...config, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Supabase URL:</strong> {config.supabaseUrl || 'Set VITE_SUPABASE_URL in .env'}
        </div>
      </Modal>
    </div>
  )
}
