'use client'
import { useEffect, useState, use } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, ShieldCheck, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { quizApi } from '@/lib/api'

type Phase = 'loading' | 'invalid' | 'expired' | 'completed' | 'intro' | 'email' | 'otp' | 'instructions' | 'quiz' | 'submitting' | 'thanks'

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

// Dark portal palette — matches the rest of the app's design tokens so the
// candidate experience feels cohesive with the HR portal.
const C = {
  bgBase: 'var(--bg-base)',
  bgSurface: 'var(--bg-surface)',
  bgElevated: 'var(--bg-elevated)',
  border: 'var(--border)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  cyan: 'var(--cyan)',
  emerald: 'var(--emerald)',
  amber: 'var(--amber)',
  rose: 'var(--rose)',
}

export default function QuizCandidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [phase, setPhase] = useState<Phase>('loading')
  const [email, setEmail] = useState('')
  const [confirmedName, setConfirmedName] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [duration, setDuration] = useState(30)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [current, setCurrent] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number>(0)
  const [questionStart, setQuestionStart] = useState<number>(Date.now())

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
    if (['SUBMITTED', 'REPORT_PUBLISHED'].includes(info.status)) {
      setPhase('thanks')
      return
    }
    if (phase === 'loading') setPhase('intro')
  }, [info, isLoading, error, phase, token])

  // Quiz countdown
  useEffect(() => {
    if (phase !== 'quiz') return
    if (secondsLeft <= 0) {
      submitMutation.mutate()
      return
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft])

  const confirmEmailMutation = useMutation({
    mutationFn: () => quizApi.confirmEmail(token, email),
    onSuccess: (res) => {
      setConfirmedName(res.data?.fullName || null)
      sendOtpMutation.mutate()
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Email check failed'),
  })

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
    onSuccess: () => setPhase('thanks'),
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Submit failed')
      setPhase('quiz')
    },
  })

  if (phase === 'loading' || isLoading) return <Full><Loader2 className="animate-spin" size={22} color={C.textMuted as any} /> <span>Loading…</span></Full>
  if (phase === 'invalid') return <Full><AlertTriangle size={22} color={C.rose as any} /> <div><h2 style={{ margin: 0, color: C.textPrimary }}>Invalid link</h2><p style={{ margin: '6px 0 0', color: C.textMuted }}>This quiz link is not recognised.</p></div></Full>
  if (phase === 'expired') return <Full><Clock size={22} color={C.amber as any} /> <div><h2 style={{ margin: 0, color: C.textPrimary }}>Link expired</h2><p style={{ margin: '6px 0 0', color: C.textMuted }}>Please contact HR for a new invite.</p></div></Full>
  if (phase === 'completed') return <Full><ShieldCheck size={22} color={C.emerald as any} /> <div><h2 style={{ margin: 0, color: C.textPrimary }}>Already submitted</h2><p style={{ margin: '6px 0 0', color: C.textMuted }}>You've already completed this quiz.</p></div></Full>

  const brand = info?.organization
  const accent = brand?.brandColor || (C.cyan as string)

  if (phase === 'intro') {
    return (
      <Card brand={brand} title={`Welcome, ${info?.candidate.firstName}`}>
        <p style={{ margin: '0 0 12px', color: C.textSecondary, lineHeight: 1.6 }}>
          You've been invited to take <strong style={{ color: C.textPrimary }}>{info?.assessmentType.name}</strong>.
        </p>
        <Stat label="Questions" value={String(info?.assessmentType.questionCount || '—')} />
        <Stat label="Time limit" value={`${info?.assessmentType.durationMinutes || '—'} min`} />
        <Stat label="Mode" value="MCQ only (no camera)" />
        <p style={{ marginTop: 18, fontSize: 13, color: C.textMuted }}>
          To begin, confirm the email this quiz was sent to.
        </p>
        <button onClick={() => setPhase('email')} style={btnPrimary(accent)}>Continue</button>
      </Card>
    )
  }

  if (phase === 'email') {
    const busy = confirmEmailMutation.isPending || sendOtpMutation.isPending
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    return (
      <Card brand={brand} title="Confirm your email">
        <p style={{ color: C.textSecondary, margin: '0 0 16px', fontSize: 14 }}>
          Enter the email this quiz was scheduled for. We'll send the access code there.
        </p>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          style={inputDark}
          onKeyDown={e => { if (e.key === 'Enter' && !busy && valid) confirmEmailMutation.mutate() }}
        />
        <button onClick={() => confirmEmailMutation.mutate()} disabled={busy || !valid}
          style={btnPrimary(accent)}>
          {busy ? 'Sending code…' : 'Send my access code'}
        </button>
        <p style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 12 }}>
          The hiring team scheduled this quiz to one specific email — typo proof.
        </p>
      </Card>
    )
  }

  if (phase === 'otp') {
    return (
      <Card brand={brand} title={confirmedName ? `Welcome, ${confirmedName}` : 'Enter access code'}>
        {confirmedName && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: C.emerald, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} /> Email confirmed.
          </p>
        )}
        <p style={{ color: C.textSecondary, margin: '0 0 16px', fontSize: 14 }}>
          We sent a 6-digit code to your email. Enter it below to start the quiz.
        </p>
        <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" placeholder="• • • • • •"
          style={{
            ...inputDark,
            fontSize: 24, letterSpacing: 8, textAlign: 'center',
            fontFamily: 'monospace',
          }} />
        <button onClick={() => verifyOtpMutation.mutate()} disabled={otp.length !== 6 || verifyOtpMutation.isPending}
          style={btnPrimary(accent)}>
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
        <ol style={{ paddingLeft: 22, color: C.textSecondary, lineHeight: 1.8, fontSize: 14 }}>
          <li>You'll have <strong style={{ color: C.textPrimary }}>{info?.assessmentType.durationMinutes} minutes</strong> to answer <strong style={{ color: C.textPrimary }}>{info?.assessmentType.questionCount} multiple-choice questions</strong>.</li>
          <li>Each question shows several options. Pick the one (or combination) you think is correct.</li>
          <li>You can navigate freely between questions until you submit.</li>
          <li>The hiring team reviews the results separately — you won't see a score on screen.</li>
          <li>Do not refresh or close the tab once you've started; the quiz auto-submits when the timer runs out.</li>
          <li>No camera or proctor — your test is self-administered.</li>
        </ol>
        <button onClick={() => fetchQuestionsMutation.mutate()} disabled={fetchQuestionsMutation.isPending}
          style={{ ...btnPrimary(accent), marginTop: 14 }}>
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
      <div style={{ minHeight: '100vh', background: C.bgBase, padding: 20 }}>
        <div style={{ maxWidth: 820, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: C.bgSurface, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <BrandHeader brand={brand} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: C.textPrimary }}>
            <span style={{ color: C.textSecondary }}>Answered <strong style={{ color: C.textPrimary }}>{answeredCount}</strong> / {total}</span>
            <span style={{
              padding: '6px 12px', borderRadius: 6, fontWeight: 600,
              background: secondsLeft < 60 ? 'rgba(225,29,72,0.12)' : 'rgba(0,212,255,0.12)',
              color: secondsLeft < 60 ? C.rose : C.cyan,
              border: `1px solid ${secondsLeft < 60 ? 'rgba(225,29,72,0.3)' : 'rgba(0,212,255,0.3)'}`,
            }}>
              <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />{mm}:{ss}
            </span>
          </div>
        </div>

        {q && (
          <div style={{ maxWidth: 820, margin: '0 auto', background: C.bgSurface, borderRadius: 10, border: `1px solid ${C.border}`, padding: 24 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Question {q.position} of {total} · {q.domain}</div>
            <h2 style={{ margin: '0 0 18px', fontSize: 17, color: C.textPrimary, lineHeight: 1.5 }}>
              {q.content?.text}
            </h2>
            {q.content?.codeBlock && (
              <pre style={{ background: C.bgBase, color: C.textPrimary, padding: 14, borderRadius: 8, fontSize: 12, overflowX: 'auto', marginBottom: 14, border: `1px solid ${C.border}` }}>
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
                    border: `1px solid ${isSelected ? accent : C.border}`,
                    borderRadius: 8, cursor: 'pointer',
                    background: isSelected ? 'rgba(0,212,255,0.06)' : C.bgElevated,
                    transition: 'all 0.15s',
                  }}>
                    <input
                      type={isMulti ? 'checkbox' : 'radio'}
                      checked={isSelected}
                      onChange={() => toggle(opt.key, isMulti)}
                      name={`q-${q.id}`}
                      style={{ marginTop: 3, accentColor: accent }}
                    />
                    <span style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.5 }}>
                      <strong style={{ marginRight: 8, color: isSelected ? accent : C.textPrimary }}>{opt.key}.</strong>{opt.text}
                    </span>
                  </label>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 22 }}>
              <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
                style={{ ...btnGhost, opacity: current === 0 ? 0.4 : 1, width: 'auto' }}>
                ← Previous
              </button>
              {current < total - 1 ? (
                <button onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
                  style={{ ...btnPrimary(accent), width: 'auto', padding: '10px 22px' }}>
                  Next →
                </button>
              ) : (
                <button onClick={() => { if (confirm(`Submit your answers? You've answered ${answeredCount} of ${total}.`)) submitMutation.mutate() }}
                  disabled={submitMutation.isPending}
                  style={{ ...btnPrimary(C.emerald), width: 'auto', padding: '10px 22px' }}>
                  {submitMutation.isPending ? 'Submitting…' : 'Submit quiz'}
                </button>
              )}
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Jump to question:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {questions.map((qq, i) => {
                  const answered = (answers[qq.id] || []).length > 0
                  const active = i === current
                  return (
                    <button key={qq.id} onClick={() => setCurrent(i)}
                      style={{
                        width: 32, height: 32, borderRadius: 6,
                        border: `1px solid ${active ? accent : answered ? 'rgba(16,185,129,0.5)' : C.border}`,
                        background: active ? accent : answered ? 'rgba(16,185,129,0.15)' : C.bgElevated,
                        color: active ? '#fff' : answered ? C.emerald : C.textPrimary,
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      }}>
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'thanks') {
    // Candidate sees only a thank-you. Score is intentionally hidden —
    // results are reviewed by HR. This matches the user's instruction
    // that the candidate "should not see" their own score.
    return (
      <Card brand={brand} title="Thank you" wide>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: '16px 18px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8 }}>
          <CheckCircle2 size={22} color={C.emerald as any} />
          <span style={{ fontSize: 14, color: C.emerald, fontWeight: 600 }}>
            Your answers have been recorded.
          </span>
        </div>
        <p style={{ color: C.textSecondary, lineHeight: 1.7, margin: 0, fontSize: 14 }}>
          Thanks for completing <strong style={{ color: C.textPrimary }}>{info?.assessmentType.name}</strong>.
          The hiring team will review your submission and reach out with the next steps.
          You can safely close this window.
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
      {brand.logoUrl && (
        <div style={{ background: '#fff', padding: '4px 6px', borderRadius: 5, display: 'inline-flex', alignItems: 'center' }}>
          <img src={brand.logoUrl} alt={brand.displayName} style={{ height: 20, objectFit: 'contain', display: 'block' }} />
        </div>
      )}
      <span style={{ fontSize: 14, fontWeight: 600, color: brand.brandColor || C.cyan }}>
        {brand.displayName}
      </span>
    </div>
  )
}

function Card({ title, children, brand, wide }: { title: string; children: React.ReactNode; brand?: QuizInfo['organization']; wide?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bgBase, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: wide ? 600 : 460, background: C.bgSurface, borderRadius: 12, padding: 28, border: `1px solid ${C.border}`, boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>
        {brand && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
            {brand.logoUrl && (
              <div style={{ background: '#fff', padding: '5px 7px', borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}>
                <img src={brand.logoUrl} alt={brand.displayName} style={{ height: 24, objectFit: 'contain', display: 'block' }} />
              </div>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: brand.brandColor || C.cyan }}>
              {brand.displayName}
            </span>
          </div>
        )}
        <h1 style={{ margin: 0, fontSize: 20, color: C.textPrimary, fontWeight: 600 }}>{title}</h1>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 14 }}>
      <span style={{ color: C.textMuted }}>{label}</span>
      <span style={{ color: C.textPrimary, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function Full({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bgBase, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 24, background: C.bgSurface, borderRadius: 12, color: C.textPrimary, minWidth: 320, border: `1px solid ${C.border}` }}>
        {children}
      </div>
    </div>
  )
}

const inputDark: React.CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 14,
  borderRadius: 10, border: `1px solid ${C.border}`,
  marginBottom: 14,
  background: C.bgElevated,
  color: C.textPrimary,
  outline: 'none',
}

function btnPrimary(accent: string): React.CSSProperties {
  return {
    width: '100%', padding: '12px 16px', fontWeight: 600,
    border: 'none', borderRadius: 8, cursor: 'pointer',
    background: accent, color: '#060B18',
    fontSize: 14,
  }
}

const btnGhost: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontWeight: 600,
  border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer',
  background: 'transparent', color: C.textPrimary, fontSize: 13,
}
