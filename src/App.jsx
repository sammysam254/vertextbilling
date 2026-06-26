import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import OnlineCustomers from './pages/OnlineCustomers'
import Payments from './pages/Payments'
import Transactions from './pages/Transactions'
import PlanSetup from './pages/PlanSetup'
import Vouchers from './pages/Vouchers'
import Coupons from './pages/Coupons'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Mikrotiks from './pages/Mikrotiks'
import Login from './pages/Login'
import CaptivePortal from './pages/CaptivePortal'
import { supabase } from './lib/supabase'

function ProtectedLayout() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('hotspot')

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar
          pathname={location.pathname}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <div className="page-body">
          <Routes>
            <Route path="/dashboard"     element={<Dashboard activeTab={activeTab} />} />
            <Route path="/customers"     element={<Customers />} />
            <Route path="/online"        element={<OnlineCustomers />} />
            <Route path="/payments"      element={<Payments />} />
            <Route path="/transactions"  element={<Transactions />} />
            <Route path="/plans"         element={<PlanSetup />} />
            <Route path="/vouchers"      element={<Vouchers />} />
            <Route path="/coupons"       element={<Coupons />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings"      element={<Settings />} />
            <Route path="/mikrotiks"     element={<Mikrotiks />} />
            <Route path="*"              element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function AuthGuard({ children }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0d1117',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid #161b22',
          borderTopColor: 'var(--teal-400)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login"  element={<Login />} />
        <Route path="/portal" element={<CaptivePortal />} />

        {/* Protected admin routes */}
        <Route
          path="/*"
          element={
            <AuthGuard>
              <ProtectedLayout />
            </AuthGuard>
          }
        />
      </Routes>
    </ThemeProvider>
  )
}
