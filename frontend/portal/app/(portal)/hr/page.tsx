'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi, reportsApi } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { Users, FileText, Clock, TrendingUp, Activity, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import Link from 'next/link'

const PIE_COLORS = ['#059669', '#E11D48', '#D97706', '#6B7280']

export default function HRDashboard() {
  const [activityRange, setActivityRange] = useState(7)

  const { data: stats } = useQuery({ queryKey: ['hr-stats'], queryFn: () => sessionsApi.getStats().then(r => r.data) })
  const { data: reports } = useQuery({ queryKey: ['hr-reports'], queryFn: () => reportsApi.getAll({ limit: 200 }).then(r => r.data) })
  const { data: activityData } = useQuery({
    queryKey: ['hr-activity', activityRange],
    queryFn: () => sessionsApi.getAll({ limit: activityRange * 3 }).then(r => r.data).catch(() => ({ sessions: [] })),
  })

  const allReports: any[] = reports?.reports || reports || []
  const recentReports = allReports.slice(0, 5)

  // Efficiency metrics
  const published = allReports.filter((r: any) => r.status === 'PUBLISHED')
  const passed = published.filter((r: any) => r.overallPassed)
  const failed = published.filter((r: any) => !r.overallPassed)
  const passRate = published.length > 0 ? Math.round((passed.length / published.length) * 100) : 0
  const avgMcq = published.length > 0 ? (published.reduce((s: number, r: any) => s + (r.mcqScore || 0), 0) / published.length).toFixed(1) : '—'
  const avgPractical = published.filter((r: any) => r.practicalScore != null).length > 0
    ? (published.filter((r: any) => r.practicalScore != null).reduce((s: number, r: any) => s + (r.practicalScore || 0), 0) / published.filter((r: any) => r.practicalScore != null).length).toFixed(1)
    : '—'
  const avgIntegrity = published.length > 0 ? (published.reduce((s: number, r: any) => s + (r.integrityScore || 0), 0) / published.length).toFixed(0) : '—'

  // Donut data
  const pieData = [
    { name: 'Pass', value: passed.length },
    { name: 'Fail', value: failed.length },
    { name: 'Pending', value: (stats?.pendingReview || 0) },
    { name: 'No-Show', value: (stats?.noShow || 0) },
  ].filter(d => d.value > 0)

  // Activity chart — last 7 days
  const sessions: any[] = activityData?.sessions || []
  const last7 = Array.from({ length: activityRange }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (activityRange - 1 - i))
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const dayStr = d.toDateString()
    return {
      date: dateStr,
      completed: sessions.filter((s: any) => new Date(s.scheduledAt).toDateString() === dayStr && s.status === 'REPORT_PUBLISHED').length,
      scheduled: sessions.filter((s: any) => new Date(s.scheduledAt).toDateString() === dayStr && s.status === 'SCHEDULED').length,
    }
  })

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>HR Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Your company's assessment activity</p>
      </div>

      {/* Stat cards row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <StatCard label="Total Assessments" value={stats?.total ?? '—'} icon={<Activity size={20} />} color="cyan" />
        <StatCard label="Assessments This Month" value={stats?.thisMonth ?? '—'} icon={<TrendingUp size={20} />} color="cyan" />
        <StatCard label="Pending Reports" value={stats?.pendingReview ?? '—'} icon={<Clock size={20} />} color="amber" />
        <StatCard label="Live Sessions" value={stats?.live ?? '—'} icon={<Activity size={20} />} color="cyan" pulse={!!stats?.live} />
      </div>

      {/* Efficiency metrics row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Overall Pass Rate', value: `${passRate}%`, color: passRate >= 60 ? 'var(--emerald)' : 'var(--amber)' },
          { label: 'Avg MCQ Score', value: `${avgMcq}%`, color: 'var(--cyan)' },
          { label: 'Avg Practical Score', value: avgPractical !== '—' ? `${avgPractical}%` : '—', color: 'var(--cyan)' },
          { label: 'Avg Integrity Score', value: avgIntegrity !== '—' ? `${avgIntegrity}/100` : '—', color: 'var(--emerald)' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending banner */}
      {(stats?.pendingReview || 0) > 0 && (
        <div style={{ background: 'rgba(215,119,6,0.1)', border: '1px solid rgba(215,119,6,0.3)', borderRadius: '8px', padding: '14px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={16} color="var(--amber)" />
          <span style={{ color: 'var(--amber)', fontSize: '14px' }}>
            {stats?.pendingReview} assessment{stats?.pendingReview !== 1 ? 's are' : ' is'} completed but reports are pending proctor review.
          </span>
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Activity chart */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Assessment Activity</h3>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {[7, 30, 90, 365].map(d => (
              <button key={d} onClick={() => setActivityRange(d)}
                style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${activityRange === d ? 'var(--cyan)' : 'var(--border)'}`, background: activityRange === d ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: activityRange === d ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                {d}d
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={last7}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="completed" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="Completed" />
              <Line type="monotone" dataKey="scheduled" stroke="#00D4FF" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" name="Scheduled" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pass rate donut */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Result Breakdown</h3>
          {pieData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                    {pieData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                {pieData.map((d: any, i: number) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>No data yet</p>
          )}
        </div>
      </div>

      {/* Recent Reports + Activity Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Recent Published Reports</h3>
          <Link href="/hr/assessments" style={{ fontSize: '13px', color: 'var(--cyan)', textDecoration: 'none' }}>View all →</Link>
        </div>
        {!recentReports.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No published reports yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Candidate</th><th>Assessment</th><th>MCQ Score</th><th>Result</th><th>Published</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {recentReports.map((r: any) => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                    {r.session?.candidate?.firstName} {r.session?.candidate?.lastName}
                  </td>
                  <td style={{ fontSize: '13px' }}>{r.session?.assessmentType?.name}</td>
                  <td>{r.mcqScore?.toFixed(1)}%</td>
                  <td>
                    <span className={`badge ${r.overallPassed ? 'badge-pass' : 'badge-fail'}`}>
                      {r.overallPassed ? 'PASS' : 'FAIL'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <Link href={`/hr/assessments/${r.sessionId}`} style={{ color: 'var(--cyan)', fontSize: '13px', textDecoration: 'none' }}>
                      View Report
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Activity Feed */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Recent Activity</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentReports.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No recent activity</p>
          ) : recentReports.map((r: any) => (
            <div key={r.id} style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', borderLeft: '3px solid var(--cyan)' }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>📋</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Report published — {r.session?.candidate?.firstName} {r.session?.candidate?.lastName}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                  {r.publishedAt ? new Date(r.publishedAt).toLocaleString() : '—'}
                </p>
              </div>
              <Link href={`/hr/assessments/${r.sessionId}`} style={{ fontSize: '11px', color: 'var(--cyan)', textDecoration: 'none', flexShrink: 0, alignSelf: 'center' }}>View</Link>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
