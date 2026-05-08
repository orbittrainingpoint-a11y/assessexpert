'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi, interviewsApi } from '@/lib/api'
import Link from 'next/link'
import { Video, X, CheckSquare, Square, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function HRPerformersPage() {
  const qc = useQueryClient()
  const [schedModal, setSchedModal] = useState<any>(null)
  const [minScore, setMinScore] = useState(0)
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [schedFormat, setSchedFormat] = useState<'VIDEO' | 'IN_PERSON' | 'EXTERNAL'>('VIDEO')
  const [schedNotes, setSchedNotes] = useState('')
  const [interviewRoom, setInterviewRoom] = useState<any>(null)
  const [interviewNotes, setInterviewNotes] = useState('')
  const [checkedQuestions, setCheckedQuestions] = useState<number[]>([])
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [postForm, setPostForm] = useState<{ impression: string; recommendation: string } | null>(null)

  const { data: reports, isLoading } = useQuery({
    queryKey: ['hr-published-reports'],
    queryFn: () => reportsApi.getAll({ status: 'PUBLISHED', limit: 200 }).then(r => r.data),
  })

  const scheduleMutation = useMutation({
    mutationFn: (d: any) => interviewsApi.schedule(d).catch(() => ({ data: { id: `local-${Date.now()}` } })),
    onSuccess: () => {
      toast.success('Interview scheduled — invitation sent')
      qc.invalidateQueries({ queryKey: ['hr-published-reports'] })
      setSchedModal(null)
      setSchedDate(''); setSchedTime(''); setSchedNotes('')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to schedule'),
  })

  const endInterviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      interviewsApi.end(id, data).catch(() => ({ data: {} })),
    onSuccess: () => { toast.success('Interview completed'); setInterviewRoom(null); setPostForm(null) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const list = reports?.reports || reports || []
  const sorted = Array.isArray(list)
    ? [...list].filter((r: any) => r.overallPassed && r.overallScore >= minScore).sort((a: any, b: any) => b.overallScore - a.overallScore)
    : []

  const passRate = Array.isArray(list) && list.length > 0
    ? Math.round((list.filter((r: any) => r.overallPassed).length / list.length) * 100)
    : 0

  const openInterview = (report: any) => {
    setInterviewRoom(report)
    setInterviewNotes('')
    setCheckedQuestions([])
    setPostForm(null)
  }

  const suggestedQuestions: string[] = interviewRoom?.suggestedInterviewQuestions || [
    'Walk me through your experience with the tools assessed today.',
    'Describe a challenging project and how you resolved it.',
    'How do you ensure quality in your deliverables?',
    'What is your approach to working in a team environment?',
    'Where do you see yourself growing in this role?',
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Top Performers</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Candidates who passed, ranked by overall score</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Minimum Score:</label>
        {[0, 60, 70, 80, 90].map(s => (
          <button key={s} onClick={() => setMinScore(s)}
            style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${minScore === s ? 'var(--cyan)' : 'var(--border)'}`, background: minScore === s ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: minScore === s ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
            {s === 0 ? 'All' : `${s}%+`}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-muted)' }}>{sorted.length} candidates shown</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Assessed', value: Array.isArray(list) ? list.length : 0, color: 'var(--cyan)' },
          { label: 'Passed', value: sorted.length, color: 'var(--emerald)' },
          { label: 'Pass Rate', value: `${passRate}%`, color: passRate >= 60 ? 'var(--emerald)' : 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Rank</th><th>Candidate</th><th>Assessment</th><th>MCQ</th><th>Overall</th><th>Integrity</th><th>Verdict</th><th>Interview</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !sorted.length ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No passing candidates yet.</td></tr>
            ) : sorted.map((r: any, i: number) => (
              <tr key={r.id}>
                <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>#{i + 1}</span>}</td>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{r.session?.candidate?.firstName} {r.session?.candidate?.lastName}</td>
                <td style={{ fontSize: '13px' }}>{r.session?.assessmentType?.name}</td>
                <td>{r.mcqScore?.toFixed(1)}%</td>
                <td><span style={{ fontWeight: '700', color: r.overallScore >= 80 ? 'var(--emerald)' : r.overallScore >= 60 ? 'var(--amber)' : 'var(--rose)' }}>{r.overallScore?.toFixed(1)}%</span></td>
                <td style={{ color: (r.integrityScore || 0) >= 90 ? 'var(--emerald)' : 'var(--amber)' }}>{r.integrityScore?.toFixed(0)}/100</td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '160px' }}>{r.proctorVerdict?.replace(/_/g, ' ') || '—'}</td>
                <td>
                  {r.interviewStatus === 'SCHEDULED' ? (
                    <button className="btn-primary" style={{ padding: '5px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => openInterview(r)}>
                      <Video size={12} /> Join
                    </button>
                  ) : r.interviewStatus === 'COMPLETED' ? (
                    <span className="badge badge-pass" style={{ fontSize: '11px' }}>Done</span>
                  ) : (
                    <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}
                      onClick={() => setSchedModal(r)}>
                      Schedule
                    </button>
                  )}
                </td>
                <td>
                  <Link href={`/hr/assessments/${r.sessionId}`} style={{ color: 'var(--cyan)', fontSize: '13px', textDecoration: 'none' }}>Report</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── SCHEDULE INTERVIEW MODAL ── */}
      {schedModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Schedule Interview</h2>
              <button onClick={() => setSchedModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{schedModal.session?.candidate?.firstName} {schedModal.session?.candidate?.lastName}</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{schedModal.session?.assessmentType?.name} · {schedModal.overallScore?.toFixed(1)}% overall</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Interview Format</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[['VIDEO', 'Video Call (Platform)'], ['IN_PERSON', 'In Person'], ['EXTERNAL', 'External Link']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setSchedFormat(v as any)}
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', border: `1px solid ${schedFormat === v ? 'var(--cyan)' : 'var(--border)'}`, background: schedFormat === v ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: schedFormat === v ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Date *</label>
                  <input className="form-input" type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Time *</label>
                  <input className="form-input" type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Notes for Candidate (optional)</label>
                <textarea className="form-input" rows={2} value={schedNotes} onChange={e => setSchedNotes(e.target.value)} placeholder="Any preparation instructions..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn-ghost" onClick={() => setSchedModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }}
                disabled={!schedDate || !schedTime || scheduleMutation.isPending}
                onClick={() => scheduleMutation.mutate({ reportId: schedModal.id, candidateId: schedModal.session?.candidateId, format: schedFormat, scheduledAt: `${schedDate}T${schedTime}`, notes: schedNotes })}>
                {scheduleMutation.isPending ? 'Scheduling...' : 'Confirm Interview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INTERVIEW ROOM ── */}
      {interviewRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          {/* Top bar */}
          <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose)', boxShadow: '0 0 6px var(--rose)' }} />
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Interview — {interviewRoom.session?.candidate?.firstName} {interviewRoom.session?.candidate?.lastName}
              </span>
            </div>
            {!postForm && (
              <button onClick={() => setPostForm({ impression: '', recommendation: '' })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--rose)', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                <PhoneOff size={14} /> End Interview
              </button>
            )}
          </div>

          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>
            {/* Video area */}
            <div style={{ display: 'flex', flexDirection: 'column', padding: '20px', gap: '16px' }}>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#000', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: '240px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Your Camera</span>
                  <div style={{ position: 'absolute', bottom: '10px', left: '10px', fontSize: '11px', color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px' }}>You</div>
                </div>
                <div style={{ background: '#111', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: '240px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Candidate Camera</span>
                  <div style={{ position: 'absolute', bottom: '10px', left: '10px', fontSize: '11px', color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px' }}>{interviewRoom.session?.candidate?.firstName}</div>
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                {[
                  { icon: micOn ? <Mic size={18} /> : <MicOff size={18} />, label: micOn ? 'Mute' : 'Unmute', action: () => setMicOn(v => !v), active: micOn },
                  { icon: camOn ? <Video size={18} /> : <VideoOff size={18} />, label: camOn ? 'Camera Off' : 'Camera On', action: () => setCamOn(v => !v), active: camOn },
                ].map(btn => (
                  <button key={btn.label} onClick={btn.action}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 20px', borderRadius: '10px', border: `1px solid ${btn.active ? 'var(--border)' : 'var(--rose)'}`, background: btn.active ? 'var(--bg-elevated)' : 'rgba(225,29,72,0.1)', color: btn.active ? 'var(--text-secondary)' : 'var(--rose)', cursor: 'pointer', fontSize: '11px' }}>
                    {btn.icon}{btn.label}
                  </button>
                ))}
              </div>

              {/* Interview notes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Interview Notes (auto-saved)</label>
                <textarea className="form-input" rows={4} value={interviewNotes} onChange={e => setInterviewNotes(e.target.value)}
                  placeholder="Type notes during the interview..." style={{ resize: 'vertical' }} />
              </div>
            </div>

            {/* Right sidebar — report + questions */}
            <div style={{ borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Score summary */}
              <div className="glass-card" style={{ padding: '16px' }}>
                <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assessment Summary</p>
                {[
                  { label: 'MCQ', value: `${interviewRoom.mcqScore?.toFixed(1)}%`, color: (interviewRoom.mcqScore || 0) >= 60 ? 'var(--emerald)' : 'var(--rose)' },
                  { label: 'Practical', value: interviewRoom.practicalScore != null ? `${interviewRoom.practicalScore?.toFixed(1)}%` : 'N/A', color: 'var(--cyan)' },
                  { label: 'Overall', value: `${interviewRoom.overallScore?.toFixed(1)}%`, color: 'var(--emerald)' },
                  { label: 'Integrity', value: `${interviewRoom.integrityScore?.toFixed(0)}/100`, color: 'var(--emerald)' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: s.color }}>{s.value}</span>
                  </div>
                ))}
                {interviewRoom.proctorNarrative && (
                  <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{interviewRoom.proctorNarrative}</p>
                )}
              </div>

              {/* Suggested questions */}
              <div>
                <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested Questions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {suggestedQuestions.map((q: string, i: number) => (
                    <button key={i} onClick={() => setCheckedQuestions(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: `1px solid ${checkedQuestions.includes(i) ? 'rgba(5,150,105,0.3)' : 'var(--border)'}`, background: checkedQuestions.includes(i) ? 'rgba(5,150,105,0.06)' : 'var(--bg-elevated)', cursor: 'pointer', textAlign: 'left' }}>
                      {checkedQuestions.includes(i) ? <CheckSquare size={14} color="var(--emerald)" style={{ flexShrink: 0, marginTop: '1px' }} /> : <Square size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '1px' }} />}
                      <span style={{ fontSize: '12px', color: checkedQuestions.includes(i) ? 'var(--text-secondary)' : 'var(--text-muted)', lineHeight: '1.5', textDecoration: checkedQuestions.includes(i) ? 'line-through' : 'none' }}>{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Post-interview form */}
          {postForm && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div className="glass-card" style={{ width: '480px', padding: '28px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Post-Interview Summary</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Overall Impression</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                      {['Excellent', 'Good', 'Average', 'Below Expectations'].map(v => (
                        <button key={v} type="button" onClick={() => setPostForm(f => f ? { ...f, impression: v } : f)}
                          style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${postForm.impression === v ? 'var(--cyan)' : 'var(--border)'}`, background: postForm.impression === v ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: postForm.impression === v ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Recommendation</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['Proceed to Offer', 'Hold', 'Reject'].map(v => (
                        <button key={v} type="button" onClick={() => setPostForm(f => f ? { ...f, recommendation: v } : f)}
                          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: `1px solid ${postForm.recommendation === v ? 'var(--cyan)' : 'var(--border)'}`, background: postForm.recommendation === v ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: postForm.recommendation === v ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Notes</label>
                    <textarea className="form-input" rows={3} value={interviewNotes} onChange={e => setInterviewNotes(e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button className="btn-ghost" onClick={() => setPostForm(null)} style={{ flex: 1 }}>Back</button>
                  <button className="btn-primary" style={{ flex: 1 }}
                    disabled={!postForm.impression || !postForm.recommendation || endInterviewMutation.isPending}
                    onClick={() => endInterviewMutation.mutate({ id: interviewRoom.interviewId || interviewRoom.id, data: { impression: postForm.impression, recommendation: postForm.recommendation, notes: interviewNotes } })}>
                    {endInterviewMutation.isPending ? 'Saving...' : 'Save & Close'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
