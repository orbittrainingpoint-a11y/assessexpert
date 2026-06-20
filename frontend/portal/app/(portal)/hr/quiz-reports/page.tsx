'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, FileText, ChevronDown, ChevronUp, CheckCircle2, XCircle, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { quizApi } from '@/lib/api'

type DomainRow = { name: string; correct: number; total: number; percentage: number; score?: number; maxScore?: number }

export default function HRQuizReportsPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const { data, isLoading } = useQuery({
    queryKey: ['hr-quiz-reports'],
    queryFn: () => quizApi.listReports().then(r => r.data),
    refetchInterval: 30_000,
  })
  const rows: any[] = Array.isArray(data) ? data : (data?.reports || [])

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Quiz Reports</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Self-administered MCQ-only assessments. Auto-published when the candidate submits — no proctor review required.
        </p>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 size={18} className="animate-spin" /> Loading reports…
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
          <FileText size={42} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text-primary)' }}>No quiz reports yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 460, marginInline: 'auto', lineHeight: 1.7 }}>
            When you schedule a candidate with <strong>Quiz only</strong> mode, their results show here as soon as they submit.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r: any) => {
            const cand = r.session?.candidate
            const at = r.session?.assessmentType
            const name = `${cand?.firstName || ''} ${cand?.lastName || ''}`.trim() || cand?.email || 'Candidate'
            const passed = r.mcqPassed ?? r.overallPassed
            const score = r.mcqScore ?? 0
            const submittedAt = r.session?.mcqSubmittedAt || r.publishedAt || r.createdAt
            const isOpen = !!expanded[r.id]
            const breakdown = (r.mcqBreakdown || {}) as any
            const domains: DomainRow[] = breakdown.domains || []

            return (
              <div key={r.id} style={{ background: 'var(--bg-surface)', border: `1px solid ${passed ? 'rgba(16,185,129,0.3)' : 'rgba(225,29,72,0.3)'}`, borderLeft: `3px solid ${passed ? 'var(--emerald)' : 'var(--rose)'}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: passed ? 'rgba(16,185,129,0.1)' : 'rgba(225,29,72,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: passed ? 'var(--emerald)' : 'var(--rose)', flexShrink: 0 }}>
                      {passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: passed ? 'rgba(16,185,129,0.1)' : 'rgba(225,29,72,0.1)', color: passed ? 'var(--emerald)' : 'var(--rose)' }}>
                          {passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>{at?.name || 'Quiz'}</span>
                        <span>{cand?.jobPosition || '—'}</span>
                        <span>{submittedAt ? new Date(submittedAt).toLocaleString() : '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: passed ? 'var(--emerald)' : 'var(--rose)', lineHeight: 1.1 }}>
                        {Math.round(score)}<span style={{ fontSize: 13, color: 'var(--text-muted)' }}>%</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>overall</div>
                    </div>
                    <DownloadPdfButton reportId={r.id} candidateName={name} />
                    {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                </div>

                {isOpen && (
                  <ExpandedDetail
                    reportId={r.id}
                    candidateEmail={cand?.email}
                    domains={domains}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Inline PDF download button. Triggers a blob fetch then drops a hidden
// anchor click to start the browser download with the server-provided
// filename (or our fallback if the response-header parse fails).
function DownloadPdfButton({ reportId, candidateName }: { reportId: string; candidateName: string }) {
  const [busy, setBusy] = useState(false)
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // don't toggle the row expand/collapse
    setBusy(true)
    try {
      const res = await quizApi.getReportPdf(reportId)
      const cd = res.headers?.['content-disposition'] as string | undefined
      const match = cd?.match(/filename="?([^";]+)"?/i)
      const filename = match?.[1] || `quiz-${candidateName.replace(/[^a-z0-9-]+/gi, '_')}.pdf`
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'PDF download failed')
    } finally { setBusy(false) }
  }
  return (
    <button onClick={onClick} disabled={busy}
      title="Download PDF report"
      style={{
        background: 'transparent', border: '1px solid var(--border)',
        color: busy ? 'var(--text-muted)' : 'var(--cyan)',
        padding: '6px 10px', borderRadius: 6, cursor: busy ? 'wait' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
      }}>
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      PDF
    </button>
  )
}

// ── Expanded detail with per-question Q&A ──────────────────────────────────
//
// Fetched lazily on expand so the list view stays fast even with a lot of
// reports. Renders: per-topic bars (carried over from the list payload),
// then every question with the candidate's choice + correct choice + a
// pass/fail strip per question.

function ExpandedDetail({ reportId, candidateEmail, domains }: { reportId: string; candidateEmail?: string; domains: DomainRow[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['hr-quiz-report-detail', reportId],
    queryFn: () => quizApi.getReportDetail(reportId).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
      {/* Per-topic bar chart */}
      {domains.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Score by topic
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {domains.map(d => (
              <div key={d.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {d.correct} / {d.total} · {d.percentage}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${d.percentage}%`, background: d.percentage >= 60 ? 'var(--emerald)' : 'var(--amber)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidateEmail && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '14px 0 0' }}>
          {candidateEmail}
        </p>
      )}

      {/* Question-by-question Q&A */}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Question-by-question
        </div>

        {isLoading && (
          <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> Loading answers…
          </div>
        )}

        {data?.questions?.map((q: any) => {
          const selected: string[] = Array.isArray(q.candidateResponse) ? q.candidateResponse : []
          const correct: string[] = Array.isArray(q.correctAnswer) ? q.correctAnswer : []
          return (
            <div key={q.position} style={{
              padding: '12px 14px', marginBottom: 10, borderRadius: 8,
              background: 'var(--bg-elevated)',
              border: `1px solid ${q.isCorrect ? 'rgba(16,185,129,0.25)' : 'rgba(225,29,72,0.25)'}`,
              borderLeft: `3px solid ${q.isCorrect ? 'var(--emerald)' : 'var(--rose)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10 }}>
                  <span>#{q.position}</span>
                  <span>·</span>
                  <span>{q.domain}</span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: q.isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(225,29,72,0.1)',
                  color: q.isCorrect ? 'var(--emerald)' : 'var(--rose)',
                }}>
                  {q.isCorrect ? 'CORRECT' : 'INCORRECT'}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: 10 }}>
                {q.content?.text}
              </p>

              {q.content?.codeBlock && (
                <pre style={{
                  background: 'var(--bg-base)', color: 'var(--text-primary)',
                  padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto', marginBottom: 10,
                }}>
                  {q.content.codeBlock}
                </pre>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(q.options || []).map((opt: any) => {
                  const isPicked = selected.includes(opt.key)
                  const isRight = correct.includes(opt.key)
                  let bg = 'var(--bg-base)'
                  let border = 'var(--border)'
                  let textColor = 'var(--text-secondary)'
                  if (isRight) { bg = 'rgba(16,185,129,0.08)'; border = 'rgba(16,185,129,0.35)'; textColor = 'var(--emerald)' }
                  if (isPicked && !isRight) { bg = 'rgba(225,29,72,0.08)'; border = 'rgba(225,29,72,0.35)'; textColor = 'var(--rose)' }

                  return (
                    <div key={opt.key} style={{
                      padding: '8px 10px', borderRadius: 6, fontSize: 12,
                      background: bg, border: `1px solid ${border}`,
                      display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start',
                    }}>
                      <div style={{ color: textColor }}>
                        <strong style={{ marginRight: 6 }}>{opt.key}.</strong>{opt.text}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {isPicked && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: isRight ? 'rgba(16,185,129,0.15)' : 'rgba(225,29,72,0.15)', color: isRight ? 'var(--emerald)' : 'var(--rose)' }}>
                            CANDIDATE
                          </span>
                        )}
                        {isRight && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(16,185,129,0.15)', color: 'var(--emerald)' }}>
                            CORRECT
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {q.timeSpentSeconds > 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
                  Time spent: {q.timeSpentSeconds}s
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
