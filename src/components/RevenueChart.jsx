import React from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// Sample data – will be replaced with Supabase real data
const SAMPLE_DATA = [
  { month: 'Jan', revenue: 78000, transactions: 42, bill: 30 },
  { month: 'Feb', revenue: 82000, transactions: 45, bill: 30 },
  { month: 'Mar', revenue: 76000, transactions: 38, bill: 30 },
  { month: 'Apr', revenue: 91000, transactions: 52, bill: 30 },
  { month: 'May', revenue: 88000, transactions: 49, bill: 30 },
  { month: 'Jun', revenue: 95000, transactions: 55, bill: 30 },
  { month: 'Jul', revenue: 102000, transactions: 58, bill: 30 },
  { month: 'Aug', revenue: 110000, transactions: 63, bill: 30 },
  { month: 'Sep', revenue: 98000, transactions: 54, bill: 30 },
  { month: 'Oct', revenue: 115000, transactions: 67, bill: 30 },
  { month: 'Nov', revenue: 128000, transactions: 72, bill: 30 },
  { month: 'Dec', revenue: 138000, transactions: 80, bill: 30 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-medium)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, background: p.color, borderRadius: 2, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
            <span style={{ fontWeight: 600, color: p.color }}>
              {p.name === 'Monthly Revenue' ? `KSH ${p.value?.toLocaleString()}` : p.value}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function RevenueChart({ data }) {
  const chartData = data || SAMPLE_DATA

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div className="chart-title">Monthly Revenue and Transactions</div>
        <div className="chart-legend">
          <div className="chart-legend-item">
            <div className="chart-legend-dot" style={{ background: '#2dd4bf' }} />
            Monthly Revenue
          </div>
          <div className="chart-legend-item">
            <div className="chart-legend-dot" style={{ background: '#f472b6' }} />
            Transactions
          </div>
          <div className="chart-legend-item">
            <div className="chart-legend-dot" style={{ background: '#fbbf24' }} />
            Monthly Bill (30 KSH/user)
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="revenue"
            orientation="left"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${(v/1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />

          <Bar
            yAxisId="revenue"
            dataKey="revenue"
            name="Monthly Revenue"
            fill="#2dd4bf"
            fillOpacity={0.7}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            yAxisId="count"
            dataKey="transactions"
            name="Transactions"
            fill="#f472b6"
            fillOpacity={0.8}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="bill"
            name="Monthly Bill (30 KSH/user)"
            stroke="#fbbf24"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#fbbf24' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
