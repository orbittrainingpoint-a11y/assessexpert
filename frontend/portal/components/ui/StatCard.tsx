'use client'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: number
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet'
  pulse?: boolean
  onClick?: () => void
}

const colorMap = {
  cyan: 'var(--cyan)',
  emerald: 'var(--emerald)',
  amber: 'var(--amber)',
  rose: 'var(--rose)',
  violet: 'var(--violet)',
}

export function StatCard({ label, value, icon, trend, color = 'cyan', pulse, onClick }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        {icon && (
          <div style={{ color: c, display: 'flex', alignItems: 'center' }}>
            {icon}
          </div>
        )}
        {pulse && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: c }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c, animation: 'pulse 2s infinite' }} />
            LIVE
          </span>
        )}
      </div>
      <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px' }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</div>
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '12px', color: trend >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}% from last month
        </div>
      )}
    </div>
  )
}
