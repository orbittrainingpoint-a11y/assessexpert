'use client'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi } from '@/lib/api'
import { Calendar, Clock } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'badge-pending', INVITED: 'badge-pending', WAITING_ROOM: 'badge-live',
  CHECKLIST: 'badge-live', MCQ_IN_PROGRESS: 'badge-live', PRACTICAL_IN_PROGRESS: 'badge-live',
  REPORT_PUBLISHED: 'badge-pass', CANCELLED: 'badge-fail', NO_SHOW: 'badge-fail', DISQUALIFIED: 'badge-fail',
  SUBMITTED: 'badge-pending', GRADING: 'badge-pending', PENDING_PROCTOR_REVIEW: 'badge-pending',
}

export default function AdminSchedulePage() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['admin-all-sessions'],
    queryFn: () => sessionsApi.getAll({ limit: 200 }).then(r => r.data),
    refetchInterval: 30000,
  })

  const list = sessions?.sessions || sessions || []

  const upcoming = Array.isArray(list) ? list.filter((s: any) => ['SCHEDULED', 'INVITED', 'WAITING_ROOM', 'CHECKLIST'].includes(s.status)) : []
  const live = Array.isArray(list) ? list.filter((s: any) => ['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'].includes(s.status)) : []

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Schedule</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>All sessions across all companies</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Live Right Now', value: live.length, color: 'var(--rose)' },
          { label: 'Upcoming', value: upcoming.length, color: 'var(--cyan)' },
          { label: 'Total Sessions', value: Array.isArray(list) ? list.length : 0, color: 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: s.color }}>{s.value}</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {live.length > 0 && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderLeft: '3px solid var(--rose)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose)', display: 'inline-block' }} />
            Live Sessions — {live.length} Active
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {live.map((s: any) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{s.candidate?.firstName} {s.candidate?.lastName}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{s.assessmentType?.name} · {s.organization?.name}</p>
                </div>
                <span className="badge badge-live">{s.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Candidate</th><th>Assessment</th><th>Company</th><th>Scheduled</th><th>Proctor</th><th>Status</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !Array.isArray(list) || !list.length ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No sessions found.</td></tr>
            ) : list.map((s: any) => (
              <tr key={s.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{s.candidate?.firstName} {s.candidate?.lastName}</td>
                <td style={{ fontSize: '13px' }}>{s.assessmentType?.name}</td>
                <td style={{ fontSize: '13px' }}>{s.organization?.name}</td>
                <td style={{ fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} color="var(--text-muted)" />
                    {new Date(s.scheduledAt).toLocaleDateString()}
                    <Clock size={12} color="var(--text-muted)" style={{ marginLeft: '4px' }} />
                    {new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td style={{ fontSize: '13px' }}>{s.proctor ? `${s.proctor.firstName} ${s.proctor.lastName}` : '—'}</td>
                <td><span className={`badge ${STATUS_COLORS[s.status] || 'badge-draft'}`}>{s.status.replace(/_/g, ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
