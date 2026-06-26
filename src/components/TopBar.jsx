import React from 'react'
import { Menu, Sun, Moon, Bell, Settings, LogOut } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PAGE_TITLES = {
  '/dashboard': 'PPPoE Dashboard',
  '/customers': 'Customers',
  '/online': 'Online Customers',
  '/payments': 'Payments',
  '/transactions': 'Transactions',
  '/plans': 'Plan Setup',
  '/vouchers': 'Vouchers',
  '/coupons': 'Coupons',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/mikrotiks': 'MikroTik Configuration',
}

export default function TopBar({ pathname, activeTab, onTabChange }) {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const title = PAGE_TITLES[pathname] || 'Dashboard'
  const showTabs = pathname === '/dashboard'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <header className="topbar">
      <Menu size={18} style={{ color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }} />

      <span className="topbar-title">{title}</span>

      {/* PPPoE / Hotspot Tabs */}
      {showTabs && (
        <div className="topbar-tabs">
          <button
            className={`topbar-tab ${activeTab === 'pppoe' ? 'active' : ''}`}
            onClick={() => onTabChange?.('pppoe')}
            id="tab-pppoe"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 3H8l-2 4h12l-2-4Z" />
            </svg>
            PPPoE
          </button>
          <button
            className={`topbar-tab ${activeTab === 'hotspot' ? 'active' : ''}`}
            onClick={() => onTabChange?.('hotspot')}
            id="tab-hotspot"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1.05 7A11 11 0 0 1 22.95 7" /><path d="M4.85 10.75A6 6 0 0 1 19.15 10.75" />
              <path d="M8.65 14.5A2 2 0 0 1 15.35 14.5" /><circle cx="12" cy="18" r="1" />
            </svg>
            Hotspot
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="topbar-actions">
        {/* Theme toggle */}
        <button className="icon-btn" onClick={toggleTheme} id="btn-theme-toggle" title="Toggle theme">
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Notifications */}
        <button className="icon-btn" style={{ position: 'relative' }} onClick={() => navigate('/notifications')} id="btn-notifications">
          <Bell size={15} />
          <span className="notif-dot" />
        </button>

        {/* Settings */}
        <button className="icon-btn" onClick={() => navigate('/settings')} id="btn-settings">
          <Settings size={15} />
        </button>

        {/* Logout */}
        <button className="logout-btn" onClick={handleLogout} id="btn-logout">
          <LogOut size={13} style={{ marginRight: 4, display: 'inline' }} />
          Logout
        </button>
      </div>
    </header>
  )
}
