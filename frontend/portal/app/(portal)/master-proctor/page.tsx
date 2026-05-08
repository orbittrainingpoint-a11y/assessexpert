'use client'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi, reportsApi, usersApi } from '@/lib/api'
import { Activity, Users, FileText, AlertCircle, Clock, Shield } from 'lucide-react'
import Link from 'next/link'

export default function MasterProctorDashboard() {
  const { data: liveSessions, isLoading: loadingLive } = useQuery({
    queryKey: ['mp-live'],
    queryFn: () => sessionsApi.getLive().then(r => r.data),
    refetchInterval: 10000,
  })
  const { data: todaySessions } = useQuery({
    queryKey: ['mp-today'],
    queryFn: () => sessionsApi.getToday().then(r => r.data),
    refetchInterval: 30000,
  })
  const { data: pendingReports } = useQuery({
    queryKey: ['mp-pending-reports'],
    queryFn: () => reportsApi.getAll({ status: 'PENDING_PROCTOR_REVIEW', limit: 200 }).then(r => r.data),
    refetchInterval: 30000,
  })
  const { data: flaggedReports } = useQuery({
    queryKey: ['mp-flagged-reports'],
    queryFn: () => reportsApi.getAll({ status: 'RETURNED_FOR_MODIFICATION', limit: 200 }).then(r => r.data),
  })
  const { data: proctorsData } = useQuery({
    queryKey: ['mp-proctors'],
    queryFn: () => usersApi.getProctors().then(r => r.data),
    refetchInterval: 15000,
  })

  const liveList: any[] = liveSessions || []
  const todayList: any[] = todaySessions?.sessions || todaySessions || []
  const pendingList: any[] = pendingReports?.reports || pendingReports || []
  const flaggedList: any[] = flaggedReports?.reports || flaggedReports || []
  const proctors: any[] = proctorsData?.proctors || proctorsData || []
  const onlineProctors = proctors.filter((p: any) => p.status === 'ACTIVE').length

  const statCards = [
    { label: 'Sessions Today', value: todayList.length, icon: <Clock size={18} />, color: 'var(--cyan)' },
    { label: 'Live Right Now', value: liveList.length, icon: <Activity size={18} />, color: 'var(--rose)', pulse: liveList.length > 0 },
    { label: 'Active Proctors', value: onlineProctors, icon: <Users size={18} />, color: 'var(--emerald)' },
    { label: 'Reports Pending', value: pendingList.length, icon: <FileText size={18} />, color: 'var(--amber)' },
    { label: 'Flagged for Revision', value: flaggedList.length, icon: <AlertCircle size={18} />, color: 'var(--rose)' },
  ]

  const getProctorStatus = (p: any) => {
    const inSession = liveList.some((s: any) => s.proctorId === p.id)
    if (inSession) return { label: 'In Session', color: 'var(--rose)' }
    if (p.status === 'ACTIVE') return { label: 'Online', color: 'var(--emerald)' }
    return { label: 'Offline', color: 'var(--text-muted)' }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Master Proctor Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Platform-wide session oversight</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', marginBottom: '24px' }}>
        {statCards.map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
            {s.pulse && <div style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose)', boxShadow: '0 0 8px var(--rose)' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: s.color }}>{s.icon}</div>
            <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Live Sessions */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose)', display: 'inline-block', boxShadow: '0 0 6px var(--rose)' }} />
              Live — {liveList.length} Active
            </h3>
            <Link href="/master-proctor/sessions" style={{ fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {!liveList.length ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No active sessions</p>
          ) : liveList.slice(0, 4).map((s: any) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', borderLeft: '3px solid var(--rose)', marginBottom: '6px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{s.assessmentType?.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{s.organization?.name} · {s.status.replace(/_/g, ' ')}</p>
              </div>
              <Link href={`/master-proctor/sessions?join=${s.id}`} style={{ fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '6px' }}>
                Observe
              </Link>
            </div>
          ))}
        </div>

        {/* Proctor Status Panel */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
              <Shield size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--cyan)' }} />
              Proctor Status
            </h3>
            <Link href="/master-proctor/proctors" style={{ fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none' }}>Manage →</Link>
          </div>
          {!proctors.length ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No proctors found</p>
          ) : proctors.slice(0, 6).map((p: any) => {
            const st = getProctorStatus(p)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,212,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--cyan)', flexShrink: 0 }}>
                  {p.firstName?.[0]}{p.lastName?.[0]}
                </div>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{p.firstName} {p.lastName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: st.color }} />
                  <span style={{ fontSize: '11px', color: st.color }}>{st.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Today's Full Schedule */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Today's Full Schedule</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{todayList.length} session{todayList.length !== 1 ? 's' : ''}</span>
        </div>
        {!todayList.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No sessions scheduled for today</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>Candidate</th><th>Assessment</th><th>Company</th><th>Proctor</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {todayList.map((s: any) => {
                const isLive = ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS', 'WAITING_ROOM', 'CHECKLIST'].includes(s.status)
                return (
                  <tr key={s.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '13px' }}>{s.candidate?.firstName} {s.candidate?.lastName}</td>
                    <td style={{ fontSize: '12px' }}>{s.assessmentType?.name}</td>
                    <td style={{ fontSize: '12px' }}>{s.organization?.name}</td>
                    <td style={{ fontSize: '12px' }}>{s.proctor ? `${s.proctor.firstName} ${s.proctor.lastName}` : '—'}</td>
                    <td>
                      <span className={`badge ${isLive ? 'badge-live' : s.status === 'REPORT_PUBLISHED' ? 'badge-pass' : 'badge-pending'}`} style={{ fontSize: '11px' }}>
                        {s.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {isLive && (
                        <Link href={`/master-proctor/sessions?join=${s.id}`} style={{ fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none' }}>Observe</Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Reports */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>📋 Pending Reports — {pendingList.length}</h3>
          <Link href="/master-proctor/reports" style={{ fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none' }}>View all →</Link>
        </div>
        {!pendingList.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No pending reports</p>
        ) : pendingList.slice(0, 5).map((r: any) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '6px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{r.session?.candidate?.firstName} {r.session?.candidate?.lastName}</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{r.session?.assessmentType?.name} · {r.session?.organization?.name}</p>
            </div>
            <Link href={`/master-proctor/reports/${r.sessionId}`} style={{ fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none' }}>Review →</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
