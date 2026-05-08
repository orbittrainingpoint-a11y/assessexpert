'use client'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi, reportsApi } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { Calendar, FileText, Clock, Activity, Star } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import Link from 'next/link'

const PIE_COLORS = ['#059669', '#D97706', '#00D4FF']

export default function ProctorDashboard() {
  const { data: stats } = useQuery({ queryKey: ['proctor-stats'], queryFn: () => sessionsApi.getStats().then(r => r.data) })
  const { data: todaySessions } = useQuery({ queryKey: ['today-sessions'], queryFn: () => sessionsApi.getToday().then(r => r.data) })
  const { data: pendingReports } = useQuery({ queryKey: ['pending-reports'], queryFn: () => reportsApi.getAll({ status: 'PENDING_REVIEW' }).then(r => r.data) })
  const { data: activityData } = useQuery({
    queryKey: ['proctor-activity'],
    queryFn: () => sessionsApi.getAll({ limit: 30 }).then(r => r.data).catch(() => ({ sessions: [] })),
  })

  const todayList: any[] = todaySessions?.sessions || todaySessions || []
  const pendingList: any[] = pendingReports?.reports || pendingReports || []
  const sessions: any[] = activityData?.sessions || []

  // Build sessions-over-time data (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const count = sessions.filter((s: any) => new Date(s.scheduledAt).toDateString() === d.toDateString()).length
    return { date: dateStr, sessions: count }
  })

  // Report status distribution
  const published = sessions.filter((s: any) => s.status === 'REPORT_PUBLISHED').length
  const pending = pendingList.length
  const inProgress = sessions.filter((s: any) => ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'].includes(s.status)).length
  const pieData = [
    { name: 'Published', value: published },
    { name: 'Pending Review', value: pending },
    { name: 'In Progress', value: inProgress },
  ].filter(d => d.value > 0)

  // Company breakdown
  const companyMap: Record<string, number> = {}
  sessions.forEach((s: any) => {
    const name = s.organization?.name || 'Unknown'
    companyMap[name] = (companyMap[name] || 0) + 1
  })
  const companyBreakdown = Object.entries(companyMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const avgRating = stats?.avgHrRating ?? null
  const avgTurnaround = stats?.avgTurnaroundHours ?? null

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Proctor Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Sessions Today" value={todayList.length} icon={<Calendar size={20} />} color="cyan" />
        <StatCard label="Sessions This Month" value={stats?.thisMonth ?? '—'} icon={<Clock size={20} />} />
        <StatCard label="Reports Awaiting Review" value={pendingList.length} icon={<FileText size={20} />} color="amber" />
        <StatCard label="Live Sessions" value={stats?.live ?? '—'} icon={<Activity size={20} />} color="cyan" pulse={!!stats?.live} />
      </div>

      {/* Pending Reports */}
      {pendingList.length > 0 && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderLeft: '3px solid var(--amber)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>📋 Pending Assessment Reports</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingList.map((r: any) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    {r.session?.candidate?.firstName} {r.session?.candidate?.lastName}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {r.session?.assessmentType?.name} · Draft ready: {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <Link href={`/proctor/reports/${r.sessionId}`} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}>
                  Review & Publish →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Sessions over time */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Sessions (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={last7}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="sessions" stroke="#00D4FF" strokeWidth={2} dot={{ fill: '#00D4FF', r: 3 }} name="Sessions" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Report status donut */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Report Status</h3>
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

      {/* Bottom row: company breakdown + rating */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Company activity */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Company Activity (This Month)</h3>
          {!companyBreakdown.length ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No sessions this month</p>
          ) : companyBreakdown.map(([name, count]) => {
            const maxCount = companyBreakdown[0][1]
            return (
              <div key={name} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{count} session{count !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', background: 'var(--cyan)', borderRadius: '2px', width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Proctor rating */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>My Performance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              <Star size={20} color="var(--amber)" />
              <div>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--amber)' }}>
                  {avgRating != null ? `${avgRating.toFixed(1)} / 5.0` : '—'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>HR Feedback Score</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              <Clock size={20} color="var(--cyan)" />
              <div>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--cyan)' }}>
                  {avgTurnaround != null ? `${avgTurnaround.toFixed(1)}h` : '—'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Avg Report Turnaround</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              <Activity size={20} color="var(--emerald)" />
              <div>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--emerald)' }}>
                  {stats?.sessionsCompleted ?? '—'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Sessions Completed</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Sessions */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Today's Sessions</h3>
        {!todayList.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No sessions scheduled for today.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {todayList.map((s: any) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    {s.candidate?.firstName} {s.candidate?.lastName}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {s.assessmentType?.name} · {new Date(s.scheduledAt).toLocaleTimeString()}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge ${s.status === 'MCQ_IN_PROGRESS' || s.status === 'PRACTICAL_IN_PROGRESS' ? 'badge-live' : s.status === 'REPORT_PUBLISHED' ? 'badge-pass' : 'badge-pending'}`}>
                    {s.status.replace(/_/g, ' ')}
                  </span>
                  <Link href={`/proctor/session?id=${s.id}`} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}>
                    Join Session
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
