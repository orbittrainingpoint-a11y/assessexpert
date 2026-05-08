'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionsApi, assessmentsApi, practicalTasksApi } from '@/lib/api'
import { CheckCircle, AlertCircle, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'readiness' | 'practical' | 'approvals' | 'preview'

export default function ExamSetupReviewPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('readiness')
  const [previewAtId, setPreviewAtId] = useState('')

  const { data: atData } = useQuery({
    queryKey: ['review-at'],
    queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data),
  })

  const { data: pendingQ, isLoading: loadingQ } = useQuery({
    queryKey: ['pending-questions'],
    queryFn: () => questionsApi.getAll({ status: 'PENDING_APPROVAL', limit: 200 }).then(r => r.data),
  })

  const { data: practicalData } = useQuery({
    queryKey: ['pending-practical'],
    queryFn: () => practicalTasksApi.getAll({ status: 'PENDING_APPROVAL', limit: 200 }).then(r => r.data),
  })

  const { data: previewQ } = useQuery({
    queryKey: ['preview-questions', previewAtId],
    queryFn: () => questionsApi.getAll({ assessmentTypeId: previewAtId, status: 'ACTIVE', limit: 10 }).then(r => r.data),
    enabled: !!previewAtId,
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => questionsApi.update(id, { status: 'ACTIVE' }),
    onSuccess: () => { toast.success('Question approved'); qc.invalidateQueries({ queryKey: ['pending-questions'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => questionsApi.archive(id),
    onSuccess: () => { toast.success('Question rejected'); qc.invalidateQueries({ queryKey: ['pending-questions'] }) },
  })

  const atList: any[] = atData?.assessmentTypes || atData || []
  const questions: any[] = pendingQ?.questions || pendingQ || []
  const practicals: any[] = practicalData?.practicalTasks || practicalData || []
  const previewQuestions: any[] = previewQ?.questions || previewQ || []

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'readiness', label: 'Readiness Checklist', count: atList.length },
    { key: 'practical', label: 'Practical Pending', count: practicals.length },
    { key: 'approvals', label: 'Pending Approvals', count: questions.length },
    { key: 'preview', label: 'Paper Preview' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Review & Approval</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Quality-check all exam content before it goes live</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: tab === t.key ? '600' : '400', color: tab === t.key ? 'var(--cyan)' : 'var(--text-muted)', borderBottom: tab === t.key ? '2px solid var(--cyan)' : '2px solid transparent', marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{ padding: '1px 6px', borderRadius: '10px', background: tab === t.key ? 'rgba(0,212,255,0.15)' : 'var(--bg-elevated)', fontSize: '11px', color: tab === t.key ? 'var(--cyan)' : 'var(--text-muted)' }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1 — Readiness Checklist */}
      {tab === 'readiness' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!atList.length ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No assessment types found</div>
          ) : atList.map((at: any) => {
            const active = at.activeQuestions ?? at._count?.questions ?? 0
            const min = (at.mcqQuestionCount ?? 25) * 2
            const hasPractical = at.practicalType && at.practicalType !== 'NONE'
            const mcqOk = active >= min
            const checks = [
              { label: `MCQ pool: ${active} active (min ${min})`, ok: mcqOk },
              { label: `Practical tasks configured`, ok: hasPractical },
              { label: `Pass thresholds set`, ok: !!at.mcqPassThreshold },
              { label: `Duration configured`, ok: !!at.mcqDurationMinutes },
            ]
            const allOk = checks.every(c => c.ok)
            return (
              <div key={at.id} className="glass-card" style={{ padding: '16px', borderLeft: `3px solid ${allOk ? 'var(--emerald)' : 'var(--amber)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{at.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{at.category} · {at.status}</p>
                  </div>
                  <span style={{ fontSize: '13px', color: allOk ? 'var(--emerald)' : 'var(--amber)' }}>
                    {allOk ? '✅ Ready' : '⚠ Needs attention'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                  {checks.map(c => (
                    <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: c.ok ? 'var(--emerald)' : 'var(--rose)' }}>
                      {c.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab 2 — Practical Pending */}
      {tab === 'practical' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!practicals.length ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>✅</p>
              <p style={{ color: 'var(--text-secondary)' }}>No practical tasks pending approval</p>
            </div>
          ) : practicals.map((t: any) => (
            <div key={t.id} className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{t.title}</p>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{t.description?.slice(0, 120)}...</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge badge-pending" style={{ fontSize: '11px' }}>{t.assessmentType?.name}</span>
                    <span className="badge badge-draft" style={{ fontSize: '11px' }}>{t.taskType}</span>
                    <span className="badge" style={{ fontSize: '11px' }}>{t.difficulty}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                  <button className="btn-primary" style={{ padding: '7px 16px', fontSize: '12px' }}>✓ Approve</button>
                  <button className="btn-ghost" style={{ padding: '7px 16px', fontSize: '12px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}>✗ Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3 — Pending MCQ Approvals */}
      {tab === 'approvals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loadingQ ? (
            <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>
          ) : !questions.length ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '12px' }}>✅</p>
              <p style={{ color: 'var(--text-secondary)' }}>All questions reviewed. Nothing pending.</p>
            </div>
          ) : questions.map((q: any) => (
            <div key={q.id} className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span className="badge badge-pending" style={{ fontSize: '11px' }}>{q.assessmentType?.name}</span>
                    <span className="badge badge-draft" style={{ fontSize: '11px' }}>{q.domain}</span>
                    <span className={`badge ${q.difficulty === 'EASY' ? 'badge-pass' : q.difficulty === 'MEDIUM' ? 'badge-pending' : 'badge-fail'}`} style={{ fontSize: '11px' }}>{q.difficulty}</span>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{(q.content as any)?.text}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                    {Array.isArray(q.options) && q.options.map((opt: any) => (
                      <div key={opt.key} style={{ display: 'flex', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: q.correctAnswer?.includes(opt.key) ? 'rgba(5,150,105,0.1)' : 'var(--bg-elevated)', border: `1px solid ${q.correctAnswer?.includes(opt.key) ? 'rgba(5,150,105,0.3)' : 'transparent'}` }}>
                        <span style={{ color: q.correctAnswer?.includes(opt.key) ? 'var(--emerald)' : 'var(--text-muted)', fontWeight: '600', fontSize: '12px' }}>{opt.key}.</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{opt.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                  <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }} onClick={() => approveMutation.mutate(q.id)} disabled={approveMutation.isPending}>✓ Approve</button>
                  <button className="btn-ghost" style={{ padding: '8px 20px', fontSize: '13px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }} onClick={() => rejectMutation.mutate(q.id)} disabled={rejectMutation.isPending}>✗ Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4 — Paper Preview */}
      {tab === 'preview' && (
        <div>
          <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Select Assessment Type to Preview</label>
            <select className="form-input" style={{ maxWidth: '360px' }} value={previewAtId} onChange={e => setPreviewAtId(e.target.value)}>
              <option value="">Choose assessment type...</option>
              {atList.map((at: any) => <option key={at.id} value={at.id}>{at.name}</option>)}
            </select>
          </div>

          {previewAtId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="glass-card" style={{ padding: '16px', borderLeft: '3px solid var(--cyan)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: 'var(--cyan)' }}>MCQ PAPER — Sample (first 10 active questions)</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{previewQuestions.length} questions shown</p>
              </div>
              {previewQuestions.map((q: any, i: number) => (
                <div key={q.id} className="glass-card" style={{ padding: '16px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>Q{i + 1}.</span>{(q.content as any)?.text}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                    {Array.isArray(q.options) && q.options.map((opt: any) => (
                      <div key={opt.key} style={{ display: 'flex', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: q.correctAnswer?.includes(opt.key) ? 'rgba(5,150,105,0.08)' : 'var(--bg-elevated)' }}>
                        <span style={{ color: q.correctAnswer?.includes(opt.key) ? 'var(--emerald)' : 'var(--text-muted)', fontWeight: '600', fontSize: '12px' }}>{opt.key}.</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{opt.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!previewQuestions.length && (
                <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No active questions found for this assessment type</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
