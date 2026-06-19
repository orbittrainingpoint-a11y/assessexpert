'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, FileText, ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react'
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
                    {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                    {/* Per-domain breakdown */}
                    {domains.length > 0 ? (
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
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '14px 0 0' }}>
                        No per-topic breakdown stored for this submission.
                      </p>
                    )}

                    {cand?.email && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '14px 0 0' }}>
                        {cand.email}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
