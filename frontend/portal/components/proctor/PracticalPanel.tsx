'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { sessionsApi, practicalTasksApi, reportsApi } from '@/lib/api'
import { CheckCircle, FileText, Download } from 'lucide-react'
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
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const { data: tasksData } = useQuery({
    queryKey: ['practical-tasks', assessmentTypeId],
    queryFn: () => practicalTasksApi.getAll({ assessmentTypeId, status: 'ACTIVE' }).then(r => r.data),
    enabled: !!assessmentTypeId,
  })

  const tasks = tasksData?.practicalTasks || tasksData || []
  const selectedTask = Array.isArray(tasks) ? tasks.find((t: any) => t.id === selectedTaskId) : null

  const handleAssign = async () => {
    if (!selectedTaskId) return
    setAssigning(true)
    try {
      await sessionsApi.assignPractical(sessionId, selectedTaskId)
      toast.success('Practical task assigned — practical phase started')
      onPracticalStarted()
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to assign task')
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

      {/* Task Selector */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Select Practical Task
        </h3>

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
