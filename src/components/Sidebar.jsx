import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Wifi, CreditCard, ArrowLeftRight,
  Settings2, Ticket, Tag, Bell, Settings, Router, ChevronRight,
  Zap
} from 'lucide-react'

const NAV = [
  {
    section: 'OVERVIEW',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    ]
  },
  {
    section: 'CUSTOMERS',
    items: [
      { label: 'Customers', icon: Users, path: '/customers' },
      { label: 'Online Customers', icon: Wifi, path: '/online' },
    ]
  },
  {
    section: 'PAYMENTS',
    items: [
      { label: 'Payments', icon: CreditCard, path: '/payments' },
      { label: 'Transactions', icon: ArrowLeftRight, path: '/transactions' },
    ]
  },
  {
    section: 'BILLING',
    items: [
      { label: 'Plan Setup', icon: Settings2, path: '/plans' },
      { label: 'Vouchers', icon: Ticket, path: '/vouchers' },
      { label: 'Coupons', icon: Tag, path: '/coupons' },
    ]
  },
  {
    section: 'CONFIGURATION',
    items: [
      { label: 'Notifications', icon: Bell, path: '/notifications' },
      { label: 'Settings', icon: Settings, path: '/settings' },
      { label: 'Mikrotiks', icon: Router, path: '/mikrotiks' },
    ]
  },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-avatar">V</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="sidebar-brand-name">Vertex Billing</span>
            <span className="sidebar-brand-status" />
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>Hotspot Management</div>
        </div>
      </div>

      {/* Navigation */}
      {NAV.map(group => (
        <div key={group.section} className="sidebar-section">
          <div className="sidebar-section-label">{group.section}</div>
          {group.items.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <div
                key={item.path}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.label === 'Notifications' && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--accent-red)',
                    color: '#fff',
                    borderRadius: '10px',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px'
                  }}>3</span>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Bottom – portal link */}
      <div style={{ marginTop: 'auto', padding: '12px 12px 16px' }}>
        <div
          className="sidebar-nav-item"
          onClick={() => window.open('/portal', '_blank')}
          style={{ background: 'rgba(0,184,144,0.08)', border: '1px solid rgba(0,184,144,0.15)', borderRadius: 8 }}
        >
          <Zap size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ color: 'var(--teal-300)', fontSize: 12 }}>Captive Portal</span>
          <ChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--teal-500)' }} />
        </div>
      </div>
    </aside>
  )
}
