import React from 'react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip
} from 'recharts'

const ICON_COLORS = {
  teal:   { bg: 'rgba(0,184,144,0.12)',  color: 'var(--teal-400)' },
  blue:   { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  purple: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  yellow: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  red:    { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
  pink:   { bg: 'rgba(236,72,153,0.12)', color: '#ec4899' },
  orange: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  green:  { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
}

// Generate mini sparkline data
function generateSparkData(baseValue, count = 12) {
  const arr = []
  let v = baseValue * 0.6
  for (let i = 0; i < count; i++) {
    v += (Math.random() - 0.4) * baseValue * 0.3
    v = Math.max(0, v)
    arr.push({ v: Math.round(v) })
  }
  return arr
}

export default function StatCard({
  label,
  value,
  subLabel,
  icon: Icon,
  iconColor = 'teal',
  chartColor,
  badge,
  badgeType = 'green',
  onClick,
}) {
  const colors = ICON_COLORS[iconColor] || ICON_COLORS.teal
  const sparkColor = chartColor || colors.color
  const numericVal = typeof value === 'string'
    ? parseFloat(value.replace(/[^0-9.]/g, '')) || 100
    : (value || 100)
  const sparkData = generateSparkData(numericVal)

  return (
    <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {Icon && (
          <div className="stat-card-icon" style={{ background: colors.bg }}>
            <Icon size={18} color={colors.color} />
          </div>
        )}
      </div>

      <div className="stat-card-value">{value ?? '—'}</div>

      {subLabel && <div className="stat-card-sub">{subLabel}</div>}

      {badge && (
        <span className={`badge badge-${badgeType}`} style={{ marginBottom: 4 }}>
          {badge}
        </span>
      )}

      {/* Sparkline */}
      <div className="stat-card-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-medium)',
                borderRadius: 6,
                fontSize: 11,
                color: 'var(--text-primary)',
                padding: '4px 8px',
              }}
              itemStyle={{ color: sparkColor }}
              formatter={(v) => [v, '']}
              labelFormatter={() => ''}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={sparkColor}
              strokeWidth={1.5}
              fill={`url(#sg-${label})`}
              dot={false}
              activeDot={{ r: 3, fill: sparkColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
