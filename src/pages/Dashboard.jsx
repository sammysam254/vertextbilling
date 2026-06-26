import React, { useState, useEffect } from 'react'
import {
  Users, DollarSign, TrendingUp, AlertCircle,
  Wifi, WifiOff, UserMinus, RefreshCw
} from 'lucide-react'
import StatCard from '../components/StatCard'
import RevenueChart from '../components/RevenueChart'
import { supabase } from '../lib/supabase'

const CURRENCY = 'KSH'

function fmt(n) {
  if (!n && n !== 0) return '—'
  return `${CURRENCY} ${Number(n).toLocaleString()}`
}

export default function Dashboard({ activeTab }) {
  const [stats, setStats] = useState({
    dailyCustomers: 0,
    dailyRevenue: 0,
    weeklyRevenue: 0,
    totalRevenue: 0,
    pendingRenewals: 0,
    onlineCount: 0,
    totalCount: 0,
    offlineCount: 0,
    churnedCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentPayments, setRecentPayments] = useState([])

  useEffect(() => {
    fetchStats()
    // Realtime subscription for sessions
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotspot_sessions' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchStats)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeTab])

  async function fetchStats() {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const planType = activeTab === 'hotspot' ? 'hotspot' : 'pppoe'

      // Daily payments
      const { data: daily } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'confirmed')
        .gte('created_at', today)

      // Weekly payments
      const { data: weekly } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'confirmed')
        .gte('created_at', weekAgo)

      // Total revenue
      const { data: total } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'confirmed')

      // Customers
      const { count: totalCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })

      // Online
      const { count: onlineCount } = await supabase
        .from('hotspot_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Pending renewals
      const { count: pendingRenewals } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'expiring')

      // Churned
      const { count: churnedCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'expired')

      // Daily new customers
      const { count: dailyCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today)

      // Recent payments for bottom section
      const { data: recentPays } = await supabase
        .from('payments')
        .select('*, customers(name, phone)')
        .order('created_at', { ascending: false })
        .limit(5)

      const sum = (arr) => (arr || []).reduce((s, r) => s + (r.amount || 0), 0)

      setStats({
        dailyCustomers: dailyCustomers || 0,
        dailyRevenue: sum(daily),
        weeklyRevenue: sum(weekly),
        totalRevenue: sum(total),
        pendingRenewals: pendingRenewals || 0,
        onlineCount: onlineCount || 0,
        totalCount: totalCount || 0,
        offlineCount: Math.max(0, (totalCount || 0) - (onlineCount || 0)),
        churnedCount: churnedCount || 0,
      })
      setRecentPayments(recentPays || [])
    } catch (err) {
      console.error('Stats fetch error', err)
    } finally {
      setLoading(false)
    }
  }

  const statusBadgeStyle = (status) => {
    const map = { confirmed: 'green', pending: 'yellow', failed: 'red' }
    return `badge badge-${map[status] || 'gray'}`
  }

  return (
    <div>
      {/* Stats Grid Row 1 */}
      <div className="stats-grid">
        <StatCard
          label="Daily Customers"
          value={loading ? '…' : stats.dailyCustomers}
          icon={Users}
          iconColor="teal"
          chartColor="var(--teal-400)"
        />
        <StatCard
          label="Daily Revenue"
          value={loading ? '…' : fmt(stats.dailyRevenue)}
          icon={DollarSign}
          iconColor="blue"
          chartColor="#3b82f6"
        />
        <StatCard
          label="Weekly Revenue"
          value={loading ? '…' : fmt(stats.weeklyRevenue)}
          icon={TrendingUp}
          iconColor="purple"
          chartColor="#8b5cf6"
        />
        <StatCard
          label="Total Customers"
          value={loading ? '…' : stats.totalCount}
          icon={Users}
          iconColor="yellow"
          chartColor="#f59e0b"
        />
      </div>

      {/* Stats Grid Row 2 */}
      <div className="stats-grid">
        <StatCard
          label="Total Revenue"
          value={loading ? '…' : fmt(stats.totalRevenue)}
          icon={DollarSign}
          iconColor="teal"
          chartColor="var(--teal-400)"
        />
        <StatCard
          label="Pending Renewals"
          value={loading ? '…' : stats.pendingRenewals}
          icon={AlertCircle}
          iconColor="orange"
          chartColor="#f97316"
          badge={stats.pendingRenewals > 0 ? 'Action needed' : 'All clear'}
          badgeType={stats.pendingRenewals > 0 ? 'yellow' : 'green'}
        />
        <StatCard
          label={`View ${stats.onlineCount} Online | View ${stats.offlineCount} Offline`}
          value={loading ? '…' : `${stats.onlineCount} / ${stats.totalCount}`}
          icon={Wifi}
          iconColor="green"
          chartColor="#10b981"
        />
        <StatCard
          label="Churned Customers"
          value={loading ? '…' : stats.churnedCount}
          icon={UserMinus}
          iconColor="red"
          chartColor="#ef4444"
          badge={stats.churnedCount > 0 ? 'Needs attention' : 'Great!'}
          badgeType={stats.churnedCount > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Revenue Chart */}
      <RevenueChart />

      {/* Recent Payments */}
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-toolbar-title">Recent Payments</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchStats}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentPayments.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px' }}>
                  No payments yet
                </td>
              </tr>
            ) : recentPayments.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.customers?.name || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.customers?.phone}</div>
                </td>
                <td style={{ fontWeight: 700, color: 'var(--teal-400)' }}>{fmt(p.amount)}</td>
                <td style={{ textTransform: 'capitalize' }}>{p.method || '—'}</td>
                <td><code style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{p.reference || '—'}</code></td>
                <td><span className={statusBadgeStyle(p.status)}>{p.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
