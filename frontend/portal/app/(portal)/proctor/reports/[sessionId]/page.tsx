'use client'
import { useState, Suspense } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { reportsApi, sessionsApi, transcriptApi } from '@/lib/api'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle, FileText, Download, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const PRACTICAL_VERDICTS = ['Excellent', 'Good', 'Satisfactory', 'Below Standard'] as const
const OVERALL_VERDICTS = [
  { value: 'CLEAN', label: 'Clean — No concerns' },
  { value: 'CLEAN_MINOR', label: 'Clean — Minor observations noted' },
  { value: 'FLAGGED', label: 'Flagged — Integrity concerns; recommend caution' },
  { value: 'DISQUALIFIED', label: 'Disqualified — Clear violation; do not hire' },
] as const

function ReportReviewContent() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [narrative, setNarrative] = useState('')
  const [practicalVerdict, setPracticalVerdict] = useState('')
  const [overallVerdict, setOverallVerdict] = useState('')
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)

  const { data: report, isLoading } = useQuery({
    queryKey: ['proctor-report', sessionId],
    queryFn: () => reportsApi.getBySession(sessionId).then(r => r.data).catch(() => null),
    enabled: !!sessionId,
  })

  const { data: session } = useQuery({
    queryKey: ['session-for-report', sessionId],
    queryFn: () => sessionsApi.getOne(sessionId).then(r => r.data),
    enabled: !!sessionId,
  })

  const { data: transcriptData } = useQuery({
    queryKey: ['verification-transcript', sessionId],
    queryFn: () => transcriptApi.get(sessionId).then(r => r.data),
    enabled: !!sessionId,
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      await reportsApi.updateProctorFields(sessionId, { narrative, practicalVerdict, overallVerdict })
      await reportsApi.publish(sessionId)
    },
    onSuccess: () => {
      toast.success('Report published to HR Dashboard')
      router.push('/proctor/reports')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to publish'),
  })

  const canPublish = narrative.trim().length >= 50 && practicalVerdict && overallVerdict && check1 && check2

  if (isLoading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading report...</div>

  // No report yet — show generate CTA
  if (!report && session) return (
    <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
      <div className="glass-card" style={{ padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <h2 style={{ color: 'var(--text-primary)', margin: '0 0 12px' }}>Report Not Generated Yet</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', marginBottom: '24px' }}>
          The AI report for {session?.candidate?.firstName} {session?.candidate?.lastName} has not been generated yet.
          Click below to generate it now.
        </p>
        <button className="btn-primary" style={{ padding: '12px 32px', fontSize: '15px' }}
          onClick={() => reportsApi.generate(sessionId).then(() => { toast.success('Report generation started'); window.location.reload() }).catch((e: any) => toast.error(e.response?.data?.message || 'Failed'))}
        >
          🤖 Generate AI Report
        </button>
        <div style={{ marginTop: '16px' }}>
          <Link href="/proctor/reports" style={{ color: 'var(--cyan)', fontSize: '13px', textDecoration: 'none' }}>← Back to Reports</Link>
        </div>
      </div>
    </div>
  )

  if (!report) return <div style={{ color: 'var(--rose)', padding: '40px' }}>Session not found.</div>

  const candidate = session?.candidate
  const mcqScore = session?.mcqScore ?? report?.mcqScore ?? 0
  const mcqTotal = session?.assessmentType?.mcqCount ?? 25
  const practicalScore = report?.practicalScore ?? 0
  const integrityScore = report?.integrityScore ?? 100
  const integrityColor = integrityScore >= 90 ? 'var(--emerald)' : integrityScore >= 75 ? 'var(--amber)' : integrityScore >= 50 ? 'var(--orange, #f97316)' : 'var(--rose)'

  const flags: any[] = report?.flags || []
  const recordingUrl: string = report?.recordingUrl || session?.recordingUrl || ''

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Report Review — {candidate?.firstName} {candidate?.lastName}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            {session?.assessmentType?.name} · {session?.organization?.name}
          </p>
        </div>
        <Link href="/proctor/reports" style={{ fontSize: '13px', color: 'var(--cyan)', textDecoration: 'none' }}>← Back to Reports</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '20px' }}>

        {/* ── LEFT: Review Tools ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Recording Player */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Session Recording</h3>
            {recordingUrl ? (
              <div>
                <video controls style={{ width: '100%', borderRadius: '8px', background: '#000', marginBottom: '10px' }} src={recordingUrl} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[
                    { label: 'MCQ Start', time: session?.mcqStartedAt },
                    { label: 'MCQ End', time: session?.mcqEndedAt },
                    { label: 'Practical Start', time: session?.practicalStartedAt },
                    { label: 'Practical End', time: session?.endedAt },
                  ].filter(m => m.time).map(m => (
                    <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 8px', background: 'var(--bg-elevated)', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                      <span style={{ color: 'var(--cyan)' }}>{new Date(m.time!).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px', textAlign: 'center' }}>
                <Play size={24} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Recording not available</p>
              </div>
            )}
          </div>

          {/* Practical Submission */}
          {session?.practicalSubmissionUrl && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Practical Submission</h3>
              <a href={session.practicalSubmissionUrl} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px', textDecoration: 'none', color: 'var(--cyan)', fontSize: '13px' }}>
                <Download size={14} /> Download Submitted File
              </a>
            </div>
          )}

          {/* AI Evaluation Summary */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>AI Evaluation Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'MCQ Score', value: `${mcqScore}/${mcqTotal} (${Math.round((mcqScore / mcqTotal) * 100)}%)`, color: mcqScore / mcqTotal >= 0.6 ? 'var(--emerald)' : 'var(--rose)' },
                { label: 'Practical Score', value: `${practicalScore}/100`, color: practicalScore >= 60 ? 'var(--emerald)' : 'var(--rose)' },
                { label: 'Integrity Score', value: `${integrityScore}/100`, color: integrityColor },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>

            {flags.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirmed Flags ({flags.length})</p>
                {flags.map((f: any, i: number) => (
                  <div key={i} style={{ padding: '6px 10px', background: 'rgba(225,29,72,0.08)', borderRadius: '6px', fontSize: '12px', color: 'var(--rose)', marginBottom: '4px' }}>
                    {f.eventType?.replace(/_/g, ' ')} · {new Date(f.timestamp).toLocaleTimeString()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Proctor Assessment ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* AI Report Preview */}
          {report?.aiNarrative && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                <FileText size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--cyan)' }} />
                AI-Generated Report
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>{report.aiNarrative}</p>
            </div>
          )}

          {/* Verification Conversation Transcript — read-only, captured by the
              browsers during pre-exam verification. Cannot be edited. */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                <FileText size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--cyan)' }} />
                Verification Conversation
              </h3>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Read-only · captured live
              </span>
            </div>
            {(() => {
              const lines: any[] = (transcriptData?.lines as any[]) || []
              if (!lines.length) {
                return (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No transcript captured. Speech-to-text requires Chrome/Edge during the verification phase.
                  </p>
                )
              }
              return (
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lines.map((l: any, i: number) => {
                    const isProctor = l.speaker === 'PROCTOR'
                    return (
                      <div key={i} style={{
                        padding: '8px 10px', borderRadius: '6px',
                        background: isProctor ? 'rgba(0,212,255,0.06)' : 'rgba(5,150,105,0.06)',
                        borderLeft: `3px solid ${isProctor ? 'var(--cyan)' : 'var(--emerald)'}`,
                        userSelect: 'text', cursor: 'default',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                          <span style={{ color: isProctor ? 'var(--cyan)' : 'var(--emerald)', fontWeight: 600, textTransform: 'uppercase' }}>
                            {l.speaker}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                          {l.text}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Proctor Assessment Form */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Proctor Assessment</h3>

            {/* Practical Quality Verdict */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Practical Quality Verdict *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                {PRACTICAL_VERDICTS.map(v => (
                  <button key={v} onClick={() => setPracticalVerdict(v)}
                    style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${practicalVerdict === v ? 'var(--cyan)' : 'var(--border)'}`, background: practicalVerdict === v ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: practicalVerdict === v ? 'var(--cyan)' : 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', fontWeight: practicalVerdict === v ? '600' : '400' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Overall Proctor Verdict */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Overall Proctor Verdict *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {OVERALL_VERDICTS.map(v => (
                  <button key={v.value} onClick={() => setOverallVerdict(v.value)}
                    style={{ padding: '10px 14px', borderRadius: '6px', border: `1px solid ${overallVerdict === v.value ? 'var(--cyan)' : 'var(--border)'}`, background: overallVerdict === v.value ? 'rgba(0,212,255,0.08)' : 'var(--bg-elevated)', color: overallVerdict === v.value ? 'var(--cyan)' : 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontWeight: overallVerdict === v.value ? '600' : '400' }}>
                    {overallVerdict === v.value ? '● ' : '○ '}{v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Proctor Narrative */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Proctor Narrative * <span style={{ color: narrative.length >= 50 ? 'var(--emerald)' : 'var(--rose)', fontWeight: '600' }}>({narrative.length}/50 min)</span>
              </label>
              <textarea
                className="form-input"
                rows={5}
                value={narrative}
                onChange={e => setNarrative(e.target.value)}
                placeholder="Write your professional assessment of the candidate's performance, behaviour, and any observations from the session..."
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Confirmation Checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              {[
                { checked: check1, set: setCheck1, label: 'I have reviewed the screen recording and all submitted materials.' },
                { checked: check2, set: setCheck2, label: 'I confirm this report accurately reflects the candidate\'s performance.' },
              ].map((item, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)}
                    style={{ marginTop: '2px', width: '15px', height: '15px', accentColor: 'var(--cyan)', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: item.checked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{item.label}</span>
                </label>
              ))}
            </div>

            {/* Publish Button */}
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px', opacity: canPublish ? 1 : 0.4, cursor: canPublish ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={!canPublish || publishMutation.isPending}
              onClick={() => canPublish && publishMutation.mutate()}
            >
              <CheckCircle size={16} />
              {publishMutation.isPending ? 'Publishing...' : '📤 Publish Report to HR Dashboard'}
            </button>

            {!canPublish && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Complete all fields above to unlock publish
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProctorReportReviewPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>}>
      <ReportReviewContent />
    </Suspense>
  )
}
