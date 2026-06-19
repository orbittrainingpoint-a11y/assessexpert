'use client'
import { useEffect, useMemo, useState, use } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, ShieldCheck, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { quizApi } from '@/lib/api'

type Phase = 'loading' | 'invalid' | 'expired' | 'completed' | 'intro' | 'otp' | 'instructions' | 'quiz' | 'submitting' | 'thanks'

type QuizInfo = {
  id: string
  status: string
  mode: string
  scheduledAt: string
  candidate: { firstName: string; lastName: string; emailMask: string }
  assessmentType: { name: string; description: string | null; durationMinutes: number; questionCount: number }
  organization: { id: string; displayName: string; logoUrl: string | null; brandColor: string | null }
}

type Question = {
  position: number
  id: string
  type: string
  content: { text?: string; codeBlock?: string; imageUrl?: string }
  options: Array<{ key: string; text: string }>
  domain: string
}

export default function QuizCandidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [phase, setPhase] = useState<Phase>('loading')
  const [otp, setOtp] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [duration, setDuration] = useState(30)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [current, setCurrent] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number>(0)
  const [questionStart, setQuestionStart] = useState<number>(Date.now())
  const [report, setReport] = useState<any>(null)

  const { data: info, isLoading, error } = useQuery<QuizInfo>({
    queryKey: ['quiz', token],
    queryFn: () => quizApi.getByToken(token).then(r => r.data),
    retry: false,
  })

  useEffect(() => {
    if (isLoading) return
    if (error) {
      const msg = (error as any)?.response?.data?.message || ''
      setPhase(msg.toLowerCase().includes('expired') ? 'expired' : 'invalid')
      return
    }
    if (!info) return
    if (['COMPLETED', 'SUBMITTED'].includes(info.status)) {
      // Already done — fetch report and show thank-you
      quizApi.getReport(token).then(r => { setReport(r.data); setPhase('thanks') }).catch(() => setPhase('completed'))
      return
    }
    if (phase === 'loading') setPhase('intro')
  }, [info, isLoading, error, phase, token])

  // Quiz countdown timer
  useEffect(() => {
    if (phase !== 'quiz') return
    if (secondsLeft <= 0) {
      // Auto-submit on timeout
      submitMutation.mutate()
      return
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft])

  const sendOtpMutation = useMutation({
    mutationFn: () => quizApi.sendOtp(token),
    onSuccess: () => { toast.success('Code sent to your email'); setPhase('otp') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Could not send code'),
  })

  const verifyOtpMutation = useMutation({
    mutationFn: () => quizApi.verifyOtp(token, otp),
    onSuccess: () => setPhase('instructions'),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Invalid code'),
  })

  const fetchQuestionsMutation = useMutation({
    mutationFn: () => quizApi.getQuestions(token),
    onSuccess: (res) => {
      setQuestions(res.data.questions)
      setDuration(res.data.durationMinutes)
      setSecondsLeft(res.data.durationMinutes * 60)
      setQuestionStart(Date.now())
      setPhase('quiz')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Could not load questions'),
  })

  const submitMutation = useMutation({
    mutationFn: () => {
      setPhase('submitting')
      return quizApi.submit(token, questions.map(q => ({
        questionId: q.id,
        selected: answers[q.id] || [],
        timeSpentSeconds: 0,
      })))
    },
    onSuccess: async () => {
      try {
        const r = await quizApi.getReport(token)
        setReport(r.data)
      } catch {}
      setPhase('thanks')
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Submit failed')
      setPhase('quiz')
    },
  })

  // Single render switch
  if (phase === 'loading' || isLoading) return <Full><Loader2 className="animate-spin" size={22} /> <span>Loading…</span></Full>
  if (phase === 'invalid') return <Full><AlertTriangle size={22} color="#e11d48" /> <div><h2 style={{ margin: 0 }}>Invalid link</h2><p style={{ margin: '6px 0 0', color: '#94a3b8' }}>This quiz link is not recognised.</p></div></Full>
  if (phase === 'expired') return <Full><Clock size={22} color="#f59e0b" /> <div><h2 style={{ margin: 0 }}>Link expired</h2><p style={{ margin: '6px 0 0', color: '#94a3b8' }}>Please contact HR for a new invite.</p></div></Full>
  if (phase === 'completed') return <Full><ShieldCheck size={22} color="#10b981" /> <div><h2 style={{ margin: 0 }}>Already submitted</h2><p style={{ margin: '6px 0 0', color: '#94a3b8' }}>You've already completed this quiz.</p></div></Full>

  const brand = info?.organization

  if (phase === 'intro') {
    return (
      <Card brand={brand} title={`Welcome, ${info?.candidate.firstName}`}>
        <p style={{ margin: '0 0 12px', color: '#475569', lineHeight: 1.6 }}>
          You've been invited to take <strong>{info?.assessmentType.name}</strong>.
        </p>
        <Stat label="Questions" value={String(info?.assessmentType.questionCount || '—')} />
        <Stat label="Time limit" value={`${info?.assessmentType.durationMinutes || '—'} min`} />
        <Stat label="Mode" value="MCQ only (no camera)" />
        <p style={{ marginTop: 18, fontSize: 13, color: '#64748b' }}>
          We'll email a 6-digit access code to <strong>{info?.candidate.emailMask}</strong>.
          Click below to receive it.
        </p>
        <button onClick={() => sendOtpMutation.mutate()} disabled={sendOtpMutation.isPending}
          style={btnPrimary(brand?.brandColor)}>
          {sendOtpMutation.isPending ? 'Sending…' : 'Send access code'}
        </button>
      </Card>
    )
  }

  if (phase === 'otp') {
    return (
      <Card brand={brand} title="Enter access code">
        <p style={{ color: '#475569', margin: '0 0 16px', fontSize: 14 }}>
          We sent a 6-digit code to your email. Enter it below to start the quiz.
        </p>
        <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" placeholder="• • • • • •"
          style={{
            width: '100%', padding: '14px 16px', fontSize: 24, letterSpacing: 8,
            textAlign: 'center', borderRadius: 10, border: '1px solid #cbd5e1',
            fontFamily: 'monospace', marginBottom: 14,
          }} />
        <button onClick={() => verifyOtpMutation.mutate()} disabled={otp.length !== 6 || verifyOtpMutation.isPending}
          style={btnPrimary(brand?.brandColor)}>
          {verifyOtpMutation.isPending ? 'Verifying…' : 'Verify & continue'}
        </button>
        <button onClick={() => sendOtpMutation.mutate()} disabled={sendOtpMutation.isPending}
          style={{ ...btnGhost, marginTop: 10 }}>
          {sendOtpMutation.isPending ? 'Resending…' : 'Resend code'}
        </button>
      </Card>
    )
  }

  if (phase === 'instructions') {
    return (
      <Card brand={brand} title="Instructions" wide>
        <ol style={{ paddingLeft: 22, color: '#334155', lineHeight: 1.8, fontSize: 14 }}>
          <li>You'll have <strong>{info?.assessmentType.durationMinutes} minutes</strong> to answer <strong>{info?.assessmentType.questionCount} multiple-choice questions</strong>.</li>
          <li>Each question shows several options. Pick the one (or combination) you think is correct.</li>
          <li>You can navigate freely between questions until you submit.</li>
          <li>Your answers are scored immediately on submit — you'll see your overall and per-topic results.</li>
          <li>Do not refresh the page or close the tab once you've started; we'll auto-submit if the time runs out.</li>
          <li>No camera or proctor — your test is self-administered.</li>
        </ol>
        <button onClick={() => fetchQuestionsMutation.mutate()} disabled={fetchQuestionsMutation.isPending}
          style={{ ...btnPrimary(brand?.brandColor), marginTop: 14 }}>
          {fetchQuestionsMutation.isPending ? 'Loading questions…' : 'Start quiz'}
        </button>
      </Card>
    )
  }

  if (phase === 'quiz' || phase === 'submitting') {
    const q = questions[current]
    const total = questions.length
    const selected = answers[q?.id] || []
    const toggle = (key: string, multi: boolean) => {
      setAnswers(prev => {
        const cur = prev[q.id] || []
        if (multi) return { ...prev, [q.id]: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] }
        return { ...prev, [q.id]: [key] }
      })
    }
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
    const ss = String(secondsLeft % 60).padStart(2, '0')
    const isMulti = q?.type === 'MULTI_SELECT'
    const answeredCount = questions.filter(x => (answers[x.id] || []).length > 0).length

    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 20 }}>
        {/* Top bar */}
        <div style={{ maxWidth: 780, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <BrandHeader brand={brand} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: '#0f172a' }}>
            <span>Answered <strong>{answeredCount}</strong> / {total}</span>
            <span style={{ padding: '6px 12px', background: secondsLeft < 60 ? '#fef2f2' : '#eff6ff', borderRadius: 6, fontWeight: 600, color: secondsLeft < 60 ? '#dc2626' : '#1e40af' }}>
              <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />{mm}:{ss}
            </span>
          </div>
        </div>

        {/* Question card */}
        {q && (
          <div style={{ maxWidth: 780, margin: '0 auto', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 24 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Question {q.position} of {total} · {q.domain}</div>
            <h2 style={{ margin: '0 0 18px', fontSize: 17, color: '#0f172a', lineHeight: 1.5 }}>
              {q.content?.text}
            </h2>
            {q.content?.codeBlock && (
              <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 14, borderRadius: 8, fontSize: 12, overflowX: 'auto', marginBottom: 14 }}>
                {q.content.codeBlock}
              </pre>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {q.options.map((opt: any) => {
                const isSelected = selected.includes(opt.key)
                return (
                  <label key={opt.key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 14px',
                    border: `1px solid ${isSelected ? '#0ea5e9' : '#e2e8f0'}`,
                    borderRadius: 8, cursor: 'pointer',
                    background: isSelected ? '#f0f9ff' : '#fff',
                  }}>
                    <input
                      type={isMulti ? 'checkbox' : 'radio'}
                      checked={isSelected}
                      onChange={() => toggle(opt.key, isMulti)}
                      name={`q-${q.id}`}
                      style={{ marginTop: 3 }}
                    />
                    <span style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.5 }}>
                      <strong style={{ marginRight: 8 }}>{opt.key}.</strong>{opt.text}
                    </span>
                  </label>
                )
              })}
            </div>

            {/* Nav */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 22 }}>
              <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
                style={{ ...btnGhost, opacity: current === 0 ? 0.5 : 1 }}>
                ← Previous
              </button>
              {current < total - 1 ? (
                <button onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
                  style={btnPrimary(brand?.brandColor)}>
                  Next →
                </button>
              ) : (
                <button onClick={() => { if (confirm(`Submit your answers? You've answered ${answeredCount} of ${total}.`)) submitMutation.mutate() }}
                  disabled={submitMutation.isPending}
                  style={{ ...btnPrimary(brand?.brandColor), background: '#10b981' }}>
                  {submitMutation.isPending ? 'Submitting…' : 'Submit quiz'}
                </button>
              )}
            </div>

            {/* Question palette */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Jump to question:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {questions.map((qq, i) => (
                  <button key={qq.id} onClick={() => setCurrent(i)}
                    style={{
                      width: 32, height: 32, borderRadius: 6,
                      border: `1px solid ${i === current ? '#0ea5e9' : '#cbd5e1'}`,
                      background: i === current ? '#0ea5e9' : (answers[qq.id] || []).length > 0 ? '#dcfce7' : '#fff',
                      color: i === current ? '#fff' : '#0f172a',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'thanks') {
    return (
      <Card brand={brand} title="Thank you for submitting" wide>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
          <CheckCircle2 size={20} color="#10b981" />
          <span style={{ fontSize: 14, color: '#15803d', fontWeight: 600 }}>
            Your answers have been recorded.
          </span>
        </div>
        {report && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Your score</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
                  {report.mcqScore}<span style={{ fontSize: 18, color: '#64748b' }}>%</span>
                </div>
              </div>
              <span style={{
                padding: '8px 16px', borderRadius: 6, fontWeight: 700, fontSize: 12,
                background: report.passed ? '#dcfce7' : '#fee2e2',
                color: report.passed ? '#15803d' : '#991b1b',
              }}>
                {report.overallResult}
              </span>
            </div>

            {report.breakdown?.domains && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>Score by topic</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {report.breakdown.domains.map((d: any) => (
                    <div key={d.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: '#0f172a' }}>{d.name}</span>
                        <span style={{ color: '#475569' }}>{d.correct} / {d.total} · {d.percentage}%</span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                        <div style={{
                          height: '100%', borderRadius: 3, width: `${d.percentage}%`,
                          background: d.percentage >= 60 ? '#10b981' : '#f59e0b',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <p style={{ marginTop: 18, fontSize: 12, color: '#64748b' }}>
          The hiring team will review your results. You can close this window.
        </p>
      </Card>
    )
  }

  return null
}

// ── UI helpers ─────────────────────────────────────────────────────────────

function BrandHeader({ brand }: { brand?: QuizInfo['organization'] }) {
  if (!brand) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {brand.logoUrl && <img src={brand.logoUrl} alt={brand.displayName} style={{ height: 24, objectFit: 'contain' }} />}
      <span style={{ fontSize: 14, fontWeight: 600, color: brand.brandColor || '#0f172a' }}>
        {brand.displayName}
      </span>
    </div>
  )
}

function Card({ title, children, brand, wide }: { title: string; children: React.ReactNode; brand?: QuizInfo['organization']; wide?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: wide ? 600 : 460, background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 10px 40px rgba(15,23,42,0.08)' }}>
        {brand && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
            {brand.logoUrl && <img src={brand.logoUrl} alt={brand.displayName} style={{ height: 28, objectFit: 'contain' }} />}
            <span style={{ fontSize: 14, fontWeight: 600, color: brand.brandColor || '#0f172a' }}>
              {brand.displayName}
            </span>
          </div>
        )}
        <h1 style={{ margin: 0, fontSize: 20, color: '#0f172a', fontWeight: 600 }}>{title}</h1>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#0f172a', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function Full({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 24, background: '#fff', borderRadius: 12, color: '#0f172a', minWidth: 320 }}>
        {children}
      </div>
    </div>
  )
}

function btnPrimary(brandColor?: string | null): React.CSSProperties {
  return {
    width: '100%', padding: '12px 16px', fontWeight: 600,
    border: 'none', borderRadius: 8, cursor: 'pointer',
    background: brandColor || '#0ea5e9', color: '#fff',
    fontSize: 14,
  }
}

const btnGhost: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontWeight: 600,
  border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer',
  background: '#fff', color: '#0f172a', fontSize: 13,
}
