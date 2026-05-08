'use client'
import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { candidatesApi, reportsApi, recordingsApi } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, FileText, Video, Download, Clock } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'var(--cyan)', MCQ_IN_PROGRESS: 'var(--rose)', PRACTICAL_IN_PROGRESS: 'var(--rose)',
  SUBMITTED: 'var(--amber)', PENDING_PROCTOR_REVIEW: 'var(--amber)', REPORT_PUBLISHED: 'var(--emerald)',
  NO_SHOW: 'var(--rose)', CANCELLED: 'var(--rose)',
}

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate-detail', id],
    queryFn: () => candidatesApi.getOne(id).then(r => r.data),
  })

  const { data: reportsData } = useQuery({
    queryKey: ['candidate-reports', id],
    queryFn: () => reportsApi.getAll({ candidateId: id, limit: 20 }).then(r => r.data),
    enabled: !!id,
  })

  const handleWatchRecording = async (sessionId: string) => {
    try {
      const { data } = await recordingsApi.getUrl(sessionId)
      window.open(data.url, '_blank')
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Recording not available or expired')
    }
  }

  if (isLoading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>
  if (!candidate) return <div style={{ color: 'var(--rose)', padding: '40px' }}>Candidate not found</div>

  const sessions = candidate.sessions || []
  const reports: any[] = reportsData?.reports || reportsData || []
  const latestReport = reports[0]
  const latestSession = sessions[0]

  // Build timeline events
  const timeline: { label: string; time: string; icon: string }[] = []
  if (candidate.createdAt) timeline.push({ label: 'Candidate added', time: candidate.createdAt, icon: '👤' })
  sessions.forEach((s: any) => {
    if (s.createdAt) timeline.push({ label: `Assessment scheduled — ${s.assessmentType?.name}`, time: s.createdAt, icon: '📅' })
    if (s.invitationSentAt) timeline.push({ label: 'Invitation email sent', time: s.invitationSentAt, icon: '📧' })
    if (s.mcqStartedAt) timeline.push({ label: 'Session started', time: s.mcqStartedAt, icon: '▶️' })
    if (s.endedAt) timeline.push({ label: 'Session completed', time: s.endedAt, icon: '✅' })
  })
  reports.forEach((r: any) => {
    if (r.publishedAt) timeline.push({ label: 'Report published', time: r.publishedAt, icon: '📋' })
  })
  timeline.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const hasScheduled = sessions.some((s: any) => ['SCHEDULED', 'INVITED'].includes(s.status))

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            {candidate.firstName} {candidate.lastName}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>{candidate.email} · {candidate.jobPosition}</p>
        </div>
        {latestSession && (
          <span style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '20px', background: `${STATUS_COLOR[latestSession.status] || 'var(--text-muted)'}18`, color: STATUS_COLOR[latestSession.status] || 'var(--text-muted)', fontSize: '12px', fontWeight: '600', border: `1px solid ${STATUS_COLOR[latestSession.status] || 'var(--border)'}44` }}>
            {latestSession.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Personal Info */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Personal Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              ['Email', candidate.email],
              ['Phone', candidate.phone || '—'],
              ['Job Role', candidate.jobPosition || '—'],
              ['Experience', candidate.yearsExperience ? `${candidate.yearsExperience} years` : '—'],
              ['Department', candidate.department || '—'],
              ['Assessment', candidate.assessmentType?.name || '—'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{v}</span>
              </div>
            ))}
          </div>
          {candidate.notes && (
            <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <p style={{ margin: '0 0 4px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px' }}>Internal Notes</p>
              {candidate.notes}
            </div>
          )}
        </div>

        {/* Assessment Info + Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Latest Report Summary */}
          {latestReport ? (
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Latest Assessment Result</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px', marginBottom: '14px' }}>
                {[
                  { label: 'MCQ', value: `${latestReport.mcqScore?.toFixed(1)}%`, passed: latestReport.mcqPassed },
                  { label: 'Overall', value: `${latestReport.overallScore?.toFixed(1)}%`, passed: latestReport.overallPassed },
                  { label: 'Integrity', value: `${latestReport.integrityScore?.toFixed(0)}/100`, passed: (latestReport.integrityScore || 0) >= 75 },
                  { label: 'Result', value: latestReport.overallPassed ? 'PASS' : 'FAIL', passed: latestReport.overallPassed },
                ].map(s => (
                  <div key={s.label} style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: '6px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: s.passed ? 'var(--emerald)' : 'var(--rose)' }}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link href={`/hr/assessments/${latestReport.sessionId}`} className="btn-primary"
                  style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', fontSize: '13px' }}>
                  <FileText size={13} /> View Full Report
                </Link>
                <button className="btn-ghost" onClick={() => handleWatchRecording(latestReport.sessionId)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}>
                  <Video size={13} /> Recording
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No published reports yet</p>
            </div>
          )}

          {/* Actions */}
          <div className="glass-card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!hasScheduled && (
                <Link href={`/hr/candidates?schedule=${id}`} className="btn-primary"
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', fontSize: '13px' }}>
                  <Calendar size={14} /> Schedule Assessment
                </Link>
              )}
              {latestReport && !latestReport.overallPassed && (
                <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--amber)', borderColor: 'rgba(215,119,6,0.3)' }}>
                  <Clock size={14} /> Reschedule Assessment
                </button>
              )}
              {latestReport?.overallPassed && (
                <Link href={`/hr/performers`} className="btn-ghost"
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--emerald)', borderColor: 'rgba(5,150,105,0.3)' }}>
                  🎯 Schedule Interview
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Session History */}
      {sessions.length > 0 && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Assessment History ({sessions.length})</h3>
          <table className="data-table">
            <thead>
              <tr><th>Assessment</th><th>Scheduled</th><th>Status</th><th>MCQ</th><th>Overall</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {sessions.map((s: any) => {
                const r = reports.find((rep: any) => rep.sessionId === s.id)
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '13px' }}>{s.assessmentType?.name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(s.scheduledAt).toLocaleDateString()}</td>
                    <td><span className="badge badge-pending" style={{ fontSize: '11px' }}>{s.status.replace(/_/g, ' ')}</span></td>
                    <td style={{ fontSize: '13px' }}>{r?.mcqScore != null ? `${r.mcqScore.toFixed(1)}%` : '—'}</td>
                    <td style={{ fontSize: '13px', fontWeight: '600', color: r?.overallPassed ? 'var(--emerald)' : r ? 'var(--rose)' : 'var(--text-muted)' }}>
                      {r?.overallScore != null ? `${r.overallScore.toFixed(1)}%` : '—'}
                    </td>
                    <td>
                      {r && <Link href={`/hr/assessments/${s.id}`} style={{ fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none' }}>View Report</Link>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Activity Timeline</h3>
        {!timeline.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No activity yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {timeline.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: '14px', paddingBottom: '16px', position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    {ev.icon}
                  </div>
                  {i < timeline.length - 1 && <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '4px' }} />}
                </div>
                <div style={{ paddingTop: '4px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{ev.label}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(ev.time).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
