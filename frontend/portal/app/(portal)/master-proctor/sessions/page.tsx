'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi, usersApi } from '@/lib/api'
import { Calendar, Eye, Shield, MessageSquare, X, Send } from 'lucide-react'
import toast from 'react-hot-toast'

const LIVE_STATUSES = ['WAITING_ROOM', 'CHECKLIST', 'MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS']

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'badge-pending', INVITED: 'badge-pending', WAITING_ROOM: 'badge-live',
  CHECKLIST: 'badge-live', MCQ_IN_PROGRESS: 'badge-live', PRACTICAL_IN_PROGRESS: 'badge-live',
  REPORT_PUBLISHED: 'badge-pass', CANCELLED: 'badge-fail', NO_SHOW: 'badge-fail',
  SUBMITTED: 'badge-pending', GRADING: 'badge-pending', PENDING_PROCTOR_REVIEW: 'badge-pending',
}

export default function MasterProctorSessionsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [observingSession, setObservingSession] = useState<any>(null)
  const [controlMode, setControlMode] = useState(false)
  const [msgModal, setMsgModal] = useState<{ sessionId: string; proctorName: string } | null>(null)
  const [msgText, setMsgText] = useState('')
  const [msgPriority, setMsgPriority] = useState<'normal' | 'urgent'>('normal')

  const { data, isLoading } = useQuery({
    queryKey: ['mp-sessions', statusFilter],
    queryFn: () => sessionsApi.getAll({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
    refetchInterval: 10000,
  })

  const terminateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => sessionsApi.terminate(id, reason),
    onSuccess: () => { toast.success('Session terminated'); qc.invalidateQueries({ queryKey: ['mp-sessions'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const sendMsgMutation = useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: string; message: string }) =>
      usersApi.sendProctorMessage(sessionId, message),
    onSuccess: () => { toast.success('Message sent to proctor'); setMsgModal(null); setMsgText('') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to send'),
  })

  const list: any[] = data?.sessions || data || []
  const liveSessions = list.filter(s => LIVE_STATUSES.includes(s.status))
  const otherSessions = list.filter(s => !LIVE_STATUSES.includes(s.status))

  const phaseLabel = (status: string) => {
    if (status === 'MCQ_IN_PROGRESS') return 'MCQ Phase'
    if (status === 'PRACTICAL_IN_PROGRESS') return 'Practical Phase'
    if (status === 'CHECKLIST') return 'Verification'
    if (status === 'WAITING_ROOM') return 'Waiting Room'
    return status.replace(/_/g, ' ')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>All Sessions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Platform-wide session monitoring</p>
        </div>
        <select className="form-input" style={{ width: '220px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['SCHEDULED', 'WAITING_ROOM', 'MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED', 'CANCELLED', 'NO_SHOW'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* ── LIVE SESSIONS TILE GRID ── */}
      {liveSessions.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose)', boxShadow: '0 0 8px var(--rose)' }} />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Live Sessions — {liveSessions.length} Active
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {liveSessions.map(s => (
              <div key={s.id} className="glass-card" style={{ padding: '18px', borderLeft: '3px solid var(--rose)' }}>
                <div style={{ marginBottom: '10px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {s.assessmentType?.name}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                    {s.organization?.name}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Proctor</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{s.proctor ? `${s.proctor.firstName} ${s.proctor.lastName}` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phase</span>
                    <span style={{ color: 'var(--rose)', fontWeight: '600' }}>{phaseLabel(s.status)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Candidate</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{s.candidate?.firstName} {s.candidate?.lastName}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, padding: '7px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    onClick={() => { setObservingSession(s); setControlMode(false) }}
                  >
                    <Eye size={12} /> Join as Observer
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--cyan)', borderColor: 'rgba(0,212,255,0.3)' }}
                    onClick={() => setMsgModal({ sessionId: s.id, proctorName: s.proctor ? `${s.proctor.firstName} ${s.proctor.lastName}` : 'Proctor' })}
                    title="Message proctor"
                  >
                    <MessageSquare size={12} />
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                    onClick={() => { const r = prompt('Reason for termination?'); if (r) terminateMutation.mutate({ id: s.id, reason: r }) }}
                    title="Terminate"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ALL OTHER SESSIONS TABLE ── */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
            All Sessions {statusFilter ? `— ${statusFilter.replace(/_/g, ' ')}` : ''}
          </h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Candidate</th><th>Assessment</th><th>Company</th><th>Proctor</th><th>Scheduled</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !list.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No sessions found.</td></tr>
            ) : (statusFilter ? list : otherSessions).map((s: any) => (
              <tr key={s.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{s.candidate?.firstName} {s.candidate?.lastName}</td>
                <td style={{ fontSize: '13px' }}>{s.assessmentType?.name}</td>
                <td style={{ fontSize: '13px' }}>{s.organization?.name}</td>
                <td style={{ fontSize: '13px' }}>{s.proctor ? `${s.proctor.firstName} ${s.proctor.lastName}` : '—'}</td>
                <td style={{ fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} color="var(--text-muted)" />
                    {new Date(s.scheduledAt).toLocaleDateString()} {new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td><span className={`badge ${STATUS_BADGE[s.status] || 'badge-draft'}`}>{s.status.replace(/_/g, ' ')}</span></td>
                <td>
                  {LIVE_STATUSES.includes(s.status) && (
                    <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--cyan)', borderColor: 'rgba(0,212,255,0.3)', marginRight: '4px' }}
                      onClick={() => { setObservingSession(s); setControlMode(false) }}>
                      <Eye size={11} style={{ display: 'inline', marginRight: '3px' }} />Observe
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── OBSERVER PANEL ── */}
      {observingSession && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '800px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {controlMode ? '🔴 Control Mode' : '👁 Observer Mode'} — {observingSession.assessmentType?.name}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Proctor: {observingSession.proctor ? `${observingSession.proctor.firstName} ${observingSession.proctor.lastName}` : '—'} · {observingSession.organization?.name}
                </p>
              </div>
              <button onClick={() => { setObservingSession(null); setControlMode(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Observer / Control toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              <button
                onClick={() => setControlMode(false)}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: `1px solid ${!controlMode ? 'var(--cyan)' : 'var(--border)'}`, background: !controlMode ? 'rgba(0,212,255,0.1)' : 'transparent', color: !controlMode ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontWeight: !controlMode ? '600' : '400', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Eye size={13} /> Observer Mode
              </button>
              <button
                onClick={() => {
                  if (!controlMode && confirm('Take control of this session? The assigned proctor will be notified and lose primary control.')) {
                    setControlMode(true)
                    toast.success('You have taken session control. Proctor has been notified.')
                  } else if (controlMode) {
                    setControlMode(false)
                  }
                }}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: `1px solid ${controlMode ? 'var(--rose)' : 'var(--border)'}`, background: controlMode ? 'rgba(225,29,72,0.1)' : 'transparent', color: controlMode ? 'var(--rose)' : 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontWeight: controlMode ? '600' : '400', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Shield size={13} /> Take Control
              </button>
            </div>

            {/* Session info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: 'Candidate', value: `${observingSession.candidate?.firstName} ${observingSession.candidate?.lastName}` },
                { label: 'Phase', value: phaseLabel(observingSession.status) },
                { label: 'Status', value: observingSession.status.replace(/_/g, ' ') },
              ].map(s => (
                <div key={s.label} style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Camera feeds placeholder */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {['Candidate Camera', 'Screen Share'].map(label => (
                <div key={label} style={{ aspectRatio: '16/9', background: '#000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Private message to proctor */}
            <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                📨 PRIVATE MESSAGE TO PROCTOR (not visible to candidate)
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="form-input"
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder="Type instruction for proctor..."
                  style={{ flex: 1, fontSize: '13px' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && msgText.trim()) {
                      sendMsgMutation.mutate({ sessionId: observingSession.id, message: msgText })
                    }
                  }}
                />
                <button className="btn-primary" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}
                  disabled={!msgText.trim() || sendMsgMutation.isPending}
                  onClick={() => sendMsgMutation.mutate({ sessionId: observingSession.id, message: msgText })}>
                  <Send size={13} /> Send
                </button>
              </div>
            </div>

            {controlMode && (
              <div style={{ marginTop: '14px', padding: '14px', background: 'rgba(225,29,72,0.08)', borderRadius: '8px', border: '1px solid rgba(225,29,72,0.2)' }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: 'var(--rose)' }}>Control Mode — Additional Actions</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-ghost" style={{ fontSize: '12px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                    onClick={() => { const r = prompt('Reason for termination?'); if (r) { terminateMutation.mutate({ id: observingSession.id, reason: r }); setObservingSession(null) } }}>
                    Terminate Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MESSAGE MODAL ── */}
      {msgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>Message to {msgModal.proctorName}</h3>
              <button onClick={() => setMsgModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {(['normal', 'urgent'] as const).map(p => (
                <button key={p} onClick={() => setMsgPriority(p)}
                  style={{ flex: 1, padding: '7px', borderRadius: '6px', border: `1px solid ${msgPriority === p ? 'var(--cyan)' : 'var(--border)'}`, background: msgPriority === p ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: msgPriority === p ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize' }}>
                  {p === 'urgent' ? '🔴 ' : ''}{p}
                </button>
              ))}
            </div>
            <textarea className="form-input" rows={3} value={msgText} onChange={e => setMsgText(e.target.value)}
              placeholder="Message to proctor..." style={{ resize: 'vertical', marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost" onClick={() => setMsgModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={!msgText.trim() || sendMsgMutation.isPending}
                onClick={() => sendMsgMutation.mutate({ sessionId: msgModal.sessionId, message: `[${msgPriority.toUpperCase()}] ${msgText}` })}>
                <Send size={13} /> Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
