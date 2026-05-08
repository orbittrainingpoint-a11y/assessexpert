'use client'
import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { assessmentsApi, questionsApi, practicalTasksApi } from '@/lib/api'
import { Play, RotateCcw, Flag, Eye } from 'lucide-react'

type Mode = 'mcq' | 'practical' | 'full'
type SimState = 'setup' | 'running' | 'debrief'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function ExamSetupSimulationPage() {
  const [assessmentTypeId, setAssessmentTypeId] = useState('')
  const [mode, setMode] = useState<Mode>('mcq')
  const [simState, setSimState] = useState<SimState>('setup')
  const [simQuestions, setSimQuestions] = useState<any[]>([])
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState<{ q: any; selected: string | null; timeSpent: number; correct: boolean }[]>([])
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())
  const startTimeRef = useRef(Date.now())

  const { data: atData } = useQuery({ queryKey: ['at-sim'], queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data) })
  const { data: qData } = useQuery({
    queryKey: ['questions-sim', assessmentTypeId],
    queryFn: () => questionsApi.getAll({ assessmentTypeId, status: 'ACTIVE', limit: 500 }).then(r => r.data),
    enabled: !!assessmentTypeId,
  })
  const { data: practicalData } = useQuery({
    queryKey: ['practical-sim', assessmentTypeId],
    queryFn: () => practicalTasksApi.getAll({ assessmentTypeId, status: 'ACTIVE', limit: 10 }).then(r => r.data),
    enabled: !!assessmentTypeId && (mode === 'practical' || mode === 'full'),
  })

  const atList: any[] = atData?.assessmentTypes || atData || []
  const allQuestions: any[] = qData?.questions || qData || []
  const practicals: any[] = practicalData?.practicalTasks || practicalData || []
  const selectedAt = atList.find((a: any) => a.id === assessmentTypeId)

  const startSim = () => {
    if (mode === 'practical') { setSimState('running'); return }
    if (!allQuestions.length) return
    const count = selectedAt?.mcqQuestionCount || 25
    const picked = shuffle(allQuestions).slice(0, Math.min(count, allQuestions.length))
    setSimQuestions(picked)
    setCurrent(0)
    setSelected(null)
    setRevealed(false)
    setAnswers([])
    setFlaggedIds(new Set())
    startTimeRef.current = Date.now()
    setSimState('running')
  }

  const next = () => {
    const q = simQuestions[current]
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000)
    const correct = !!selected && (q.correctAnswer?.includes(selected) ?? false)
    setAnswers(prev => [...prev, { q, selected, timeSpent, correct }])
    startTimeRef.current = Date.now()

    if (current < simQuestions.length - 1) {
      setCurrent(c => c + 1)
      setSelected(null)
      setRevealed(false)
    } else {
      setSimState('debrief')
    }
  }

  const reset = () => { setSimState('setup'); setSimQuestions([]); setAnswers([]); setCurrent(0) }

  const toggleFlag = (id: string) => setFlaggedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const q = simQuestions[current]

  // Debrief stats
  const correctCount = answers.filter(a => a.correct).length
  const avgTime = answers.length ? Math.round(answers.reduce((s, a) => s + a.timeSpent, 0) / answers.length) : 0
  const diffDist = { EASY: 0, MEDIUM: 0, HARD: 0 } as Record<string, number>
  answers.forEach(a => { const d = a.q.difficulty || 'MEDIUM'; diffDist[d] = (diffDist[d] || 0) + 1 })

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Exam Simulation</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Preview exactly what candidates experience</p>
      </div>

      {/* SETUP */}
      {simState === 'setup' && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '420px', margin: '0 auto' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Assessment Type</label>
              <select className="form-input" value={assessmentTypeId} onChange={e => setAssessmentTypeId(e.target.value)}>
                <option value="">Select assessment type...</option>
                {atList.map((at: any) => <option key={at.id} value={at.id}>{at.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Simulation Mode</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {([['mcq', 'MCQ Only'], ['practical', 'Practical Only'], ['full', 'Full Exam']] as [Mode, string][]).map(([m, label]) => (
                  <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${mode === m ? 'var(--cyan)' : 'var(--border)'}`, background: mode === m ? 'rgba(0,212,255,0.08)' : 'var(--bg-elevated)', color: mode === m ? 'var(--cyan)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: mode === m ? '600' : '400' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {assessmentTypeId && (
              <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                {mode !== 'practical' && <p style={{ margin: '0 0 2px' }}>MCQ: {allQuestions.length} active questions · {selectedAt?.mcqQuestionCount || 25} will be selected</p>}
                {mode !== 'mcq' && <p style={{ margin: 0 }}>Practical: {practicals.length} active task{practicals.length !== 1 ? 's' : ''} available</p>}
              </div>
            )}

            <button className="btn-primary" onClick={startSim}
              disabled={!assessmentTypeId || (mode !== 'practical' && !allQuestions.length)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}>
              <Play size={16} /> Start Simulation
            </button>
          </div>
        </div>
      )}

      {/* RUNNING — MCQ */}
      {simState === 'running' && mode !== 'practical' && q && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Question {current + 1} of {simQuestions.length}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => toggleFlag(q.id)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', border: `1px solid ${flaggedIds.has(q.id) ? 'var(--rose)' : 'var(--border)'}`, background: flaggedIds.has(q.id) ? 'rgba(225,29,72,0.08)' : 'var(--bg-elevated)', color: flaggedIds.has(q.id) ? 'var(--rose)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>
                <Flag size={12} /> {flaggedIds.has(q.id) ? 'Flagged' : 'Flag Issue'}
              </button>
              <button className="btn-ghost" onClick={reset} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <RotateCcw size={12} /> Exit
              </button>
            </div>
          </div>

          <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', marginBottom: '20px' }}>
            <div style={{ height: '100%', background: 'var(--cyan)', borderRadius: '2px', width: `${((current + 1) / simQuestions.length) * 100}%`, transition: 'width 0.3s' }} />
          </div>

          <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <span className={`badge ${q.difficulty === 'EASY' ? 'badge-pass' : q.difficulty === 'HARD' ? 'badge-fail' : 'badge-pending'}`} style={{ fontSize: '11px' }}>{q.difficulty}</span>
              {q.domain && <span className="badge badge-draft" style={{ fontSize: '11px' }}>{q.domain}</span>}
            </div>
            <p style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)', lineHeight: '1.7', fontWeight: '500' }}>{(q.content as any)?.text}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {Array.isArray(q.options) && q.options.map((opt: any) => {
              const isCorrect = q.correctAnswer?.includes(opt.key)
              const isSelected = selected === opt.key
              let bg = 'var(--bg-surface)', border = 'var(--border)', color = 'var(--text-secondary)'
              if (revealed) {
                if (isCorrect) { bg = 'rgba(5,150,105,0.12)'; border = 'rgba(5,150,105,0.4)'; color = 'var(--emerald)' }
                else if (isSelected) { bg = 'rgba(225,29,72,0.08)'; border = 'rgba(225,29,72,0.3)'; color = 'var(--rose)' }
              } else if (isSelected) { bg = 'rgba(0,212,255,0.08)'; border = 'var(--cyan)'; color = 'var(--cyan)' }
              return (
                <button key={opt.key} onClick={() => { if (!revealed) setSelected(opt.key) }}
                  style={{ display: 'flex', gap: '12px', padding: '13px 16px', borderRadius: '8px', background: bg, border: `1px solid ${border}`, cursor: revealed ? 'default' : 'pointer', textAlign: 'left', transition: 'all 150ms' }}>
                  <span style={{ fontWeight: '700', color: 'var(--cyan)', flexShrink: 0 }}>{opt.key}.</span>
                  <span style={{ fontSize: '14px', color }}>{opt.text}</span>
                  {revealed && isCorrect && <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--emerald)' }}>✓ Correct</span>}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!revealed && <button className="btn-ghost" onClick={() => setRevealed(true)} disabled={!selected} style={{ flex: 1, opacity: selected ? 1 : 0.5 }}>Reveal Answer</button>}
            <button className="btn-primary" onClick={next} style={{ flex: 1 }}>
              {current < simQuestions.length - 1 ? 'Next Question →' : 'Finish & See Debrief →'}
            </button>
          </div>
        </div>
      )}

      {/* RUNNING — Practical Only */}
      {simState === 'running' && mode === 'practical' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Practical Task Preview</h3>
            <button className="btn-ghost" onClick={reset} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}><RotateCcw size={12} /> Exit</button>
          </div>
          {!practicals.length ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No active practical tasks for this assessment type</div>
          ) : practicals.map((t: any) => (
            <div key={t.id} className="glass-card" style={{ padding: '20px', borderLeft: '3px solid var(--cyan)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{t.title}</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className="badge badge-draft" style={{ fontSize: '11px' }}>{t.taskType}</span>
                  <span className={`badge ${t.difficulty === 'EASY' ? 'badge-pass' : t.difficulty === 'HARD' ? 'badge-fail' : 'badge-pending'}`} style={{ fontSize: '11px' }}>{t.difficulty}</span>
                </div>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{t.description}</p>
              {t.markingCriteria && (
                <div style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <p style={{ margin: '0 0 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>Marking Criteria:</p>
                  <p style={{ margin: 0 }}>{t.markingCriteria}</p>
                </div>
              )}
              {t.sourceFileUrl && (
                <a href={t.sourceFileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none' }}>
                  <Eye size={12} /> Preview starter file
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* DEBRIEF */}
      {simState === 'debrief' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
            {[
              { label: 'Score', value: `${correctCount}/${answers.length}`, color: correctCount / answers.length >= 0.7 ? 'var(--emerald)' : 'var(--rose)' },
              { label: 'Avg Time/Q', value: `${avgTime}s`, color: avgTime > 90 ? 'var(--rose)' : avgTime > 60 ? 'var(--amber)' : 'var(--emerald)' },
              { label: 'Flagged Issues', value: flaggedIds.size, color: flaggedIds.size > 0 ? 'var(--rose)' : 'var(--emerald)' },
              { label: 'Difficulty Mix', value: `${diffDist.EASY||0}E/${diffDist.MEDIUM||0}M/${diffDist.HARD||0}H`, color: 'var(--cyan)' },
            ].map(s => (
              <div key={s.label} className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</p>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Per-question breakdown */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Question Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {answers.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-elevated)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '24px' }}>Q{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)' }}>{(a.q.content as any)?.text?.slice(0, 60)}...</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '36px' }}>{a.timeSpent}s</span>
                  <span className={`badge ${a.q.difficulty === 'EASY' ? 'badge-pass' : a.q.difficulty === 'HARD' ? 'badge-fail' : 'badge-pending'}`} style={{ fontSize: '10px' }}>{a.q.difficulty}</span>
                  <span style={{ fontSize: '13px' }}>{a.correct ? '✅' : '❌'}</span>
                  {flaggedIds.has(a.q.id) && <span style={{ fontSize: '11px', color: 'var(--rose)' }}>🚩</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Flagged issues */}
          {flaggedIds.size > 0 && (
            <div className="glass-card" style={{ padding: '20px', borderLeft: '3px solid var(--rose)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600', color: 'var(--rose)' }}>🚩 Flagged Issues ({flaggedIds.size})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {answers.filter(a => flaggedIds.has(a.q.id)).map((a, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: 'rgba(225,29,72,0.06)', borderRadius: '6px', border: '1px solid rgba(225,29,72,0.2)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-primary)' }}>{(a.q.content as any)?.text}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Q#{a.q.id?.slice(0, 8)} · {a.q.difficulty} · {a.q.domain}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="btn-ghost" onClick={reset} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <RotateCcw size={14} /> Run Another Simulation
          </button>
        </div>
      )}
    </div>
  )
}
