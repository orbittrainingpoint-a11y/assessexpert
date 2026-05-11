'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { sessionsApi, practicalTasksApi, practicalSetsApi, reportsApi } from '@/lib/api'
import { CheckCircle, FileText, Download, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface MCQResult {
  candidateId: string
  candidateName: string
  score: number
  total: number
  passed: boolean
}

interface Props {
  sessionId: string
  assessmentTypeId: string
  mcqResults: MCQResult[]
  onPracticalStarted: () => void
}

export default function PracticalPanel({ sessionId, assessmentTypeId, mcqResults, onPracticalStarted }: Props) {
  const [mode, setMode] = useState<'set' | 'task'>('set')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [selectedSetId, setSelectedSetId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const { data: tasksData } = useQuery({
    queryKey: ['practical-tasks', assessmentTypeId],
    queryFn: () => practicalTasksApi.getAll({ assessmentTypeId, status: 'ACTIVE' }).then(r => r.data),
    enabled: !!assessmentTypeId,
  })

  const { data: setsData } = useQuery({
    queryKey: ['practical-sets', assessmentTypeId],
    queryFn: () => practicalSetsApi.list(assessmentTypeId).then(r => r.data),
    enabled: !!assessmentTypeId,
  })

  const tasks = tasksData?.practicalTasks || tasksData || []
  const sets: any[] = (setsData || []).filter((s: any) => s.status === 'ACTIVE')
  const selectedTask = Array.isArray(tasks) ? tasks.find((t: any) => t.id === selectedTaskId) : null
  const selectedSet = sets.find(s => s.id === selectedSetId)

  // Default to "set" mode only if sets exist; otherwise fall back to legacy task mode
  // (Run once on data load — naive but fine for this UI)
  if (mode === 'set' && sets.length === 0 && tasks.length > 0 && selectedSetId === '' && selectedTaskId === '') {
    setMode('task')
  }

  const handleAssign = async () => {
    setAssigning(true)
    try {
      if (mode === 'set' && selectedSetId) {
        await practicalSetsApi.assignToSession(sessionId, selectedSetId)
        toast.success(`${selectedSet?.name} assigned — practical phase started`)
      } else if (mode === 'task' && selectedTaskId) {
        await sessionsApi.assignPractical(sessionId, selectedTaskId)
        toast.success('Practical task assigned — practical phase started')
      } else {
        return
      }
      onPracticalStarted()
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to start practical')
    } finally {
      setAssigning(false)
    }
  }

  const passCount = mcqResults.filter(r => r.passed).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* MCQ Results Summary */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <CheckCircle size={18} color="var(--emerald)" />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            MCQ Phase Complete
          </h3>
          <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-muted)' }}>
            {passCount}/{mcqResults.length} passed
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {mcqResults.map(r => {
            const pct = Math.round((r.score / r.total) * 100)
            return (
              <div key={r.candidateId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-elevated)' }}>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{r.candidateName}</span>
                <div style={{ width: '120px', height: '4px', background: 'var(--bg-base)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: r.passed ? 'var(--emerald)' : 'var(--rose)' }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: r.passed ? 'var(--emerald)' : 'var(--rose)', minWidth: '60px', textAlign: 'right' }}>
                  {r.score}/{r.total} ({pct}%) {r.passed ? '✅' : '❌'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Task / Set Selector */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Assign Practical
          </h3>
          {/* Mode toggle — only show if both options exist */}
          {sets.length > 0 && tasks.length > 0 && (
            <div style={{ display: 'flex', gap: '0', background: 'var(--bg-elevated)', padding: '2px', borderRadius: '6px' }}>
              <button onClick={() => setMode('set')}
                style={{ padding: '5px 12px', fontSize: '11px', border: 'none', cursor: 'pointer', borderRadius: '4px',
                  background: mode === 'set' ? 'var(--cyan)' : 'transparent',
                  color: mode === 'set' ? '#000' : 'var(--text-muted)', fontWeight: 600 }}>
                Paper Set
              </button>
              <button onClick={() => setMode('task')}
                style={{ padding: '5px 12px', fontSize: '11px', border: 'none', cursor: 'pointer', borderRadius: '4px',
                  background: mode === 'task' ? 'var(--cyan)' : 'transparent',
                  color: mode === 'task' ? '#000' : 'var(--text-muted)', fontWeight: 600 }}>
                Legacy Task
              </button>
            </div>
          )}
        </div>

        {mode === 'set' && (
          sets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              No active paper sets for this assessment. Create one in <Link href="/master-proctor/paper-sets" style={{ color: 'var(--cyan)' }}>Practical Paper Sets</Link>.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {sets.map((s: any) => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${selectedSetId === s.id ? 'var(--cyan)' : 'var(--border)'}`, background: selectedSetId === s.id ? 'rgba(0,212,255,0.06)' : 'var(--bg-elevated)', cursor: 'pointer' }}>
                    <input type="radio" name="set" value={s.id} checked={selectedSetId === s.id} onChange={() => setSelectedSetId(s.id)}
                      style={{ marginTop: '2px', accentColor: 'var(--cyan)' }} />
                    <Layers size={16} color="var(--cyan)" style={{ marginTop: '1px' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{s.name}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                        {s._count?.questions || 0} questions · {s._count?.files || 0} attached files
                      </p>
                      {s.description && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{s.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
              <button className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14px' }}
                disabled={!selectedSetId || assigning}
                onClick={handleAssign}>
                {assigning ? 'Assigning...' : selectedSet ? `▶ Push ${selectedSet.name} & Start Practical` : '▶ Pick a set first'}
              </button>
            </>
          )
        )}

        {mode === 'task' && (
          <>
            {!Array.isArray(tasks) || !tasks.length ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No active practical tasks found for this assessment type.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {tasks.map((t: any) => (
                  <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${selectedTaskId === t.id ? 'var(--cyan)' : 'var(--border)'}`, background: selectedTaskId === t.id ? 'rgba(0,212,255,0.06)' : 'var(--bg-elevated)', cursor: 'pointer' }}>
                    <input type="radio" name="task" value={t.id} checked={selectedTaskId === t.id} onChange={() => setSelectedTaskId(t.id)}
                      style={{ marginTop: '2px', accentColor: 'var(--cyan)' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{t.title}</p>
                      <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--text-muted)' }}>{t.description?.slice(0, 100)}{t.description?.length > 100 ? '...' : ''}</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Type: {t.taskType}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Difficulty: {t.difficulty}</span>
                        {t.sourceFileUrl && <span style={{ fontSize: '11px', color: 'var(--cyan)' }}>📎 Starter file</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {selectedTask && (
              <div style={{ marginBottom: '14px', padding: '12px', background: 'var(--bg-base)', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>CANDIDATE BRIEFING (auto-sent on assign):</p>
                <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {selectedTask.description || 'Complete the assigned practical task and upload your work before the timer ends.'}
                </p>
                {selectedTask.sourceFileUrl && (
                  <a href={selectedTask.sourceFileUrl} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--cyan)', textDecoration: 'none' }}>
                    <Download size={12} /> Preview starter file
                  </a>
                )}
              </div>
            )}

            <button className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14px' }}
              disabled={!selectedTaskId || assigning}
              onClick={handleAssign}>
              {assigning ? 'Assigning...' : '▶ Assign Task & Start Practical Phase'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Post-Session Panel ─────────────────────────────────────────── */
interface PostSessionProps {
  sessionId: string
  endedAt: string
  candidateCount: number
}

export function PostSessionPanel({ sessionId, endedAt, candidateCount }: PostSessionProps) {
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [notes, setNotes] = useState('')

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await reportsApi.generate(sessionId)
      setGenerated(true)
      toast.success('AI report generated — ready for review in Tab 4')
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const duration = endedAt ? (() => {
    const mins = Math.floor((Date.now() - new Date(endedAt).getTime()) / 60000)
    return `${Math.floor(mins / 60)}hr ${mins % 60}min`
  })() : '—'

  return (
    <div className="glass-card" style={{ padding: '28px', borderTop: '3px solid var(--emerald)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <CheckCircle size={28} color="var(--emerald)" />
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Session Complete</h2>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {candidateCount} candidate{candidateCount !== 1 ? 's' : ''} submitted · Duration: {duration}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <div style={{ padding: '12px', background: 'rgba(0,212,255,0.06)', borderRadius: '8px', fontSize: '13px', color: 'var(--cyan)' }}>
          {generated
            ? '✅ AI report generated — available in Completed Assessments'
            : '⏳ AI report generation in progress (est. ~15 min after session end)'}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Session-wide incident notes (optional)</label>
          <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any session-wide observations or incidents to note..." style={{ resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {!generated && (
          <button className="btn-primary" onClick={handleGenerate} disabled={generating} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <FileText size={15} />
            {generating ? 'Generating...' : '🤖 Generate AI Report Now'}
          </button>
        )}
        <Link href="/proctor/reports" className="btn-ghost" style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          Go to Completed Assessments →
        </Link>
      </div>
    </div>
  )
}
