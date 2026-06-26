import React, { useState, useEffect } from 'react'
import { Copy, Download, Router, Plus, RefreshCw, CheckCircle, Terminal } from 'lucide-react'
import Modal from '../components/Modal'
import {
  generateHotspotSetupScript,
  generateApiUserScript,
  generatePlanProfilesScript,
  generateApiLoginTriggerScript,
  generateRemoveUserScript,
} from '../lib/mikrotik'
import { supabase } from '../lib/supabase'

const SCRIPTS = [
  { id: 'setup',    label: '1. Initial Hotspot Setup', desc: 'Configure hotspot server, DHCP, DNS and NAT' },
  { id: 'api-user', label: '2. Create API User',       desc: 'Create billing system API user with limited permissions' },
  { id: 'plans',    label: '3. Sync Plan Profiles',    desc: 'Add user profiles matching your plans' },
  { id: 'trigger',  label: '4. API Login Trigger',     desc: 'Scheduler script for <1s client activation' },
]

export default function Mikrotiks() {
  const [plans, setPlans] = useState([])
  const [activeScript, setActiveScript] = useState('setup')
  const [config, setConfig] = useState({
    interfaceName: 'ether2',
    hotspotGateway: '192.168.88.1',
    hotspotNetwork: '192.168.88.0/24',
    dnsServer: '8.8.8.8',
    hotspotName: 'Vertex-Hotspot',
    billingServerUrl: 'http://192.168.88.1:3000',
    apiUsername: 'billing-api',
    apiPassword: 'StrongP@ss123!',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  })
  const [modal, setModal] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.from('plans').select('*').then(({ data }) => setPlans(data || []))
  }, [])

  function getScript() {
    switch (activeScript) {
      case 'setup':    return generateHotspotSetupScript(config)
      case 'api-user': return generateApiUserScript(config)
      case 'plans':    return generatePlanProfilesScript(plans)
      case 'trigger':  return generateApiLoginTriggerScript(config)
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">MikroTik Configuration</h1>
          <p className="page-subtitle">Generate RouterOS scripts to configure your MikroTik router</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setModal(true)} id="btn-edit-mikrotik-config">
          <Router size={14} /> Edit Config
        </button>
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
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal-300)', marginBottom: 4 }}>How to use these scripts</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Open <strong>Winbox → New Terminal</strong> and paste each script in order (1 → 4).
            Run scripts <strong>one at a time</strong>. After step 4, your billing system will connect clients
            within <strong>1 second</strong> of payment confirmation via the Supabase Edge Function.
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
              After payment confirmed → Supabase Edge Function → MikroTik REST API → client connected instantly
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
            <button className="btn btn-primary" onClick={() => setModal(false)}>Apply</button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['interfaceName',    'Hotspot Interface', 'ether2'],
            ['hotspotGateway',   'Gateway IP',        '192.168.88.1'],
            ['hotspotNetwork',   'Network CIDR',      '192.168.88.0/24'],
            ['dnsServer',        'DNS Server',        '8.8.8.8'],
            ['hotspotName',      'Hotspot Name',      'Vertex-Hotspot'],
            ['billingServerUrl', 'Billing Server URL', 'http://192.168.88.1:3000'],
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
