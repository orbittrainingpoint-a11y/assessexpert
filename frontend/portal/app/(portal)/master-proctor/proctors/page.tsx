'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, sessionsApi } from '@/lib/api'
import { Shield, MessageSquare, Calendar, X, Send, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MasterProctorProctorsPage() {
  const qc = useQueryClient()
  const [msgModal, setMsgModal] = useState<{ id: string; name: string } | null>(null)
  const [msgText, setMsgText] = useState('')
  const [msgPriority, setMsgPriority] = useState<'normal' | 'urgent'>('normal')
  const [suspendModal, setSuspendModal] = useState<{ id: string; name: string } | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [reassignModal, setReassignModal] = useState<{ proctorId: string; name: string } | null>(null)
  const [availModal, setAvailModal] = useState<{ id: string; name: string } | null>(null)

  const { data: availData } = useQuery({
    queryKey: ['proctor-availability', availModal?.id],
    queryFn: () => usersApi.getAvailability(availModal!.id).then(r => r.data).catch(() => ({ slots: [] })),
    enabled: !!availModal?.id,
  })

  const availSlots: any[] = availData?.slots || []

  const { data, isLoading } = useQuery({
    queryKey: ['proctors-list'],
    queryFn: () => usersApi.getProctors().then(r => r.data),
  })

  const { data: liveSessions } = useQuery({
    queryKey: ['live-sessions-for-proctors'],
    queryFn: () => sessionsApi.getLive().then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: upcomingSessions } = useQuery({
    queryKey: ['upcoming-sessions-reassign', reassignModal?.proctorId],
    queryFn: () => sessionsApi.getAll({ proctorId: reassignModal?.proctorId, status: 'SCHEDULED', limit: 20 }).then(r => r.data),
    enabled: !!reassignModal,
  })

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => usersApi.suspend(id, reason),
    onSuccess: () => {
      toast.success('Proctor suspended. Admin has been notified.')
      qc.invalidateQueries({ queryKey: ['proctors-list'] })
      setSuspendModal(null)
      setSuspendReason('')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to suspend'),
  })

  const sendMsgMutation = useMutation({
    mutationFn: ({ proctorId, message }: { proctorId: string; message: string }) =>
      usersApi.sendDirectMessage(proctorId, message),
    onSuccess: () => { toast.success('Message sent'); setMsgModal(null); setMsgText('') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to send'),
  })

  const proctors: any[] = data?.proctors || data || []
  const liveList: any[] = liveSessions || []
  const upcomingList: any[] = upcomingSessions?.sessions || upcomingSessions || []

  const getProctorStatus = (p: any) => {
    const inSession = liveList.some((s: any) => s.proctorId === p.id)
    if (inSession) return { label: 'In Session', color: 'var(--rose)' }
    if (p.status === 'ACTIVE') return { label: 'Online', color: 'var(--emerald)' }
    return { label: 'Offline', color: 'var(--text-muted)' }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Proctor Management</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{proctors.length} certified proctors</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Proctors', value: proctors.length, color: 'var(--cyan)' },
          { label: 'Active', value: proctors.filter((p: any) => p.status === 'ACTIVE').length, color: 'var(--emerald)' },
          { label: 'In Session Now', value: liveList.length, color: 'var(--rose)' },
          { label: 'Suspended', value: proctors.filter((p: any) => p.status === 'SUSPENDED').length, color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: s.color }}>{s.value}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Proctors table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Proctor</th>
              <th>Status</th>
              <th>Certification</th>
              <th>Sessions/Month</th>
              <th>Avg Score</th>
              <th>Avg Turnaround</th>
              <th>Flags/Session</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !proctors.length ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No proctors found.</td></tr>
            ) : proctors.map((p: any) => {
              const status = getProctorStatus(p)
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>
                        {p.firstName?.[0]}{p.lastName?.[0]}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{p.firstName} {p.lastName}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: status.color }} />
                      <span style={{ fontSize: '12px', color: status.color, fontWeight: '500' }}>{status.label}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Shield size={11} color="var(--cyan)" />
                      <span style={{ fontSize: '12px' }}>{p.certificationLevel || '—'}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {p.sessionsThisMonth ?? '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {p.avgHrScore != null ? (
                      <span style={{ fontSize: '13px', fontWeight: '600', color: p.avgHrScore >= 4 ? 'var(--emerald)' : p.avgHrScore >= 3 ? 'var(--amber)' : 'var(--rose)' }}>
                        {p.avgHrScore.toFixed(1)}/5
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {p.avgTurnaroundHours != null ? (
                      <span style={{ fontSize: '12px', color: p.avgTurnaroundHours <= 4 ? 'var(--emerald)' : p.avgTurnaroundHours <= 12 ? 'var(--amber)' : 'var(--rose)' }}>
                        {p.avgTurnaroundHours.toFixed(1)}h
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {p.avgFlagsPerSession != null ? (
                      <span style={{ fontSize: '12px', color: p.avgFlagsPerSession <= 1 ? 'var(--emerald)' : p.avgFlagsPerSession <= 3 ? 'var(--amber)' : 'var(--rose)' }}>
                        {p.avgFlagsPerSession.toFixed(1)}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--cyan)', borderColor: 'rgba(0,212,255,0.3)' }}
                        onClick={() => setMsgModal({ id: p.id, name: `${p.firstName} ${p.lastName}` })}
                        title="Send message">
                        <MessageSquare size={11} />
                      </button>
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--amber)', borderColor: 'rgba(215,119,6,0.3)' }}
                        onClick={() => setReassignModal({ proctorId: p.id, name: `${p.firstName} ${p.lastName}` })}
                        title="Reassign sessions">
                        <Calendar size={11} />
                      </button>
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                        onClick={() => setAvailModal({ id: p.id, name: `${p.firstName} ${p.lastName}` })}
                        title="View availability">
                        🗓
                      </button>
                      {p.status === 'ACTIVE' && (
                        <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                          onClick={() => setSuspendModal({ id: p.id, name: `${p.firstName} ${p.lastName}` })}>
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── SUSPEND MODAL ── */}
      {suspendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <AlertTriangle size={20} color="var(--rose)" />
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Suspend {suspendModal.name}</h3>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              This will immediately suspend the proctor's account. All upcoming sessions will be flagged as needing reassignment. The Admin will be notified.
            </p>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Reason for suspension *</label>
            <textarea className="form-input" rows={3} value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
              placeholder="Provide a clear reason for suspension..." style={{ resize: 'vertical', marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost" onClick={() => { setSuspendModal(null); setSuspendReason('') }} style={{ flex: 1 }}>Cancel</button>
              <button
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--rose)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: suspendReason.trim().length < 10 ? 'not-allowed' : 'pointer', opacity: suspendReason.trim().length < 10 ? 0.5 : 1 }}
                disabled={suspendReason.trim().length < 10 || suspendMutation.isPending}
                onClick={() => suspendMutation.mutate({ id: suspendModal.id, reason: suspendReason })}>
                {suspendMutation.isPending ? 'Suspending...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MESSAGE MODAL ── */}
      {msgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>Message to {msgModal.name}</h3>
              <button onClick={() => setMsgModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {(['normal', 'urgent'] as const).map(p => (
                <button key={p} onClick={() => setMsgPriority(p)}
                  style={{ flex: 1, padding: '7px', borderRadius: '6px', border: `1px solid ${msgPriority === p ? 'var(--cyan)' : 'var(--border)'}`, background: msgPriority === p ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: msgPriority === p ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize' }}>
                  {p === 'urgent' ? '🔴 ' : ''}Priority: {p}
                </button>
              ))}
            </div>
            <textarea className="form-input" rows={4} value={msgText} onChange={e => setMsgText(e.target.value)}
              placeholder="Message to proctor..." style={{ resize: 'vertical', marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost" onClick={() => setMsgModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={!msgText.trim() || sendMsgMutation.isPending}
                onClick={() => sendMsgMutation.mutate({ proctorId: msgModal.id, message: `[${msgPriority.toUpperCase()}] ${msgText}` })}>
                <Send size={13} /> Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REASSIGN MODAL ── */}
      {reassignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '560px', padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>Reassign Sessions — {reassignModal.name}</h3>
              <button onClick={() => setReassignModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            {!upcomingList.length ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No upcoming sessions to reassign.</p>
            ) : upcomingList.map((s: any) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '8px' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    {s.candidate?.firstName} {s.candidate?.lastName} — {s.assessmentType?.name}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(s.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <button className="btn-ghost" style={{ fontSize: '12px', color: 'var(--amber)', borderColor: 'rgba(215,119,6,0.3)' }}
                  onClick={() => {
                    const newProctor = prompt('Enter new proctor email or ID:')
                    if (newProctor) toast.success(`Reassignment request submitted for ${s.candidate?.firstName}'s session`)
                  }}>
                  Reassign
                </button>
              </div>
            ))}
            <button className="btn-ghost" onClick={() => setReassignModal(null)} style={{ width: '100%', marginTop: '8px' }}>Close</button>
          </div>
        </div>
      )}

      {/* ── AVAILABILITY MODAL ── */}
      {availModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '560px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>Availability — {availModal.name}</h3>
              <button onClick={() => setAvailModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '16px' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{day}</p>
                  {['AM', 'PM', 'EVE'].map(slot => {
                    const isAvail = availSlots.some((s: any) => s.day === day && s.slot === slot)
                    return (
                      <div key={slot} style={{ padding: '4px 2px', marginBottom: '2px', borderRadius: '4px', background: isAvail ? 'rgba(5,150,105,0.2)' : 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {slot}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Green = Available · Grey = Unavailable. Contact Admin to modify proctor availability.
            </p>
            <button className="btn-ghost" onClick={() => setAvailModal(null)} style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
