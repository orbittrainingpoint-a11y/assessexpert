'use client'
import { useQuery } from '@tanstack/react-query'
import { adminApi, sessionsApi, salesApi } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { LayoutDashboard, Building2, Users, FileText, Activity, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import Link from 'next/link'

const PIE_COLORS = ['#00D4FF', '#059669', '#D97706', '#E11D48', '#8B5CF6', '#F59E0B']

export default function AdminDashboard() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: () => adminApi.getStats().then(r => r.data) })
  const { data: activity } = useQuery({ queryKey: ['admin-activity'], queryFn: () => adminApi.getActivity('30d').then(r => r.data) })
  const { data: salesStats } = useQuery({ queryKey: ['admin-sales'], queryFn: () => salesApi.getStats().then(r => r.data).catch(() => ({})) })
  const { data: liveSessions } = useQuery({
    queryKey: ['live-sessions'],
    queryFn: () => sessionsApi.getLive().then(r => r.data),
    refetchInterval: 15000,
  })
  const { data: auditData } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: () => adminApi.getAuditLog({ limit: 10 }).then(r => r.data).catch(() => ({ logs: [] })),
    refetchInterval: 30000,
  })

  const recentActivity: any[] = auditData?.logs || auditData || []
  const atDistribution: any[] = salesStats?.assessmentTypeDistribution || []
  const companyGrowth: any[] = salesStats?.companyGrowth || []

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Platform Overview</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Real-time platform metrics across all companies</p>
      </div>

      {/* Stats Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <StatCard label="Total Assessments (All Time)" value={stats?.totalSessions ?? '—'} icon={<LayoutDashboard size={20} />} color="cyan" />
        <StatCard label="Assessments This Month" value={stats?.sessionsThisMonth ?? '—'} icon={<Activity size={20} />} color="cyan" />
        <StatCard label="Live Sessions Right Now" value={stats?.liveSessions ?? '—'} icon={<Activity size={20} />} color="cyan" pulse={!!stats?.liveSessions} />
        <StatCard label="Reports Pending Review" value={stats?.pendingReports ?? '—'} icon={<AlertCircle size={20} />} color="amber" />
      </div>

      {/* Stats Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Active Companies" value={stats?.totalOrgs ?? '—'} icon={<Building2 size={20} />} color="emerald" />
        <StatCard label="Total Registered Users" value={stats?.totalUsers ?? '—'} icon={<Users size={20} />} />
        <StatCard label="Total Candidates Assessed" value={stats?.totalCandidates ?? '—'} icon={<Users size={20} />} />
        <StatCard label="Overall Platform Pass Rate" value={stats ? `${stats.passRate}%` : '—'} icon={<FileText size={20} />} color={stats?.passRate >= 60 ? 'emerald' : 'rose'} />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Assessment Activity (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={activity || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="completed" stroke="#059669" strokeWidth={2} dot={false} name="Completed" />
              <Line type="monotone" dataKey="scheduled" stroke="#00D4FF" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Scheduled" />
              <Line type="monotone" dataKey="pending" stroke="#D97706" strokeWidth={2} dot={false} name="Pending" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Live Sessions */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose)', display: 'inline-block', boxShadow: '0 0 6px var(--rose)' }} />
            Live Sessions
          </h3>
          {!liveSessions?.length ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No active sessions</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {liveSessions.map((s: any) => (
                <div key={s.id} style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', borderLeft: '3px solid var(--cyan)' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{s.assessmentType?.name}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{s.organization?.name} · {s.status.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts row 2 — Sales + Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Company Growth */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Company Growth (Last 12 Months)</h3>
          {companyGrowth.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={companyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Bar dataKey="newCompanies" fill="#059669" name="New Companies" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No growth data available</p>
            </div>
          )}
          {/* Sales KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px', marginTop: '12px' }}>
            {[
              { label: 'Credits Consumed (Month)', value: salesStats?.creditsConsumedThisMonth ?? '—' },
              { label: 'Renewals Due (30 days)', value: salesStats?.renewalsDue ?? '—' },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--cyan)' }}>{s.value}</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Assessment Type Distribution */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Assessment Type Distribution</h3>
          {atDistribution.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={atDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="count" nameKey="name">
                    {atDistribution.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {atDistribution.slice(0, 6).map((item: any, i: number) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No distribution data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Recent Platform Activity</h3>
          <Link href="/admin/settings" style={{ fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none' }}>View Audit Log →</Link>
        </div>
        {!recentActivity.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No recent activity</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentActivity.map((log: any, i: number) => (
              <div key={log.id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>{log.event || log.action || 'Platform event'}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
