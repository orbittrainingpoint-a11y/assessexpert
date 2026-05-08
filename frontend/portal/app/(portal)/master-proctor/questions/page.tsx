'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionsApi, assessmentsApi, practicalTasksApi } from '@/lib/api'
import { Plus, Upload, FileText, Code, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

type View = 'list' | 'mcq' | 'practical'

const BLANK_Q = { text: '', optA: '', optB: '', optC: '', optD: '', correctAnswer: 'A', difficulty: 'MEDIUM', domain: '' }

export default function MasterProctorQuestionsPage() {
  const qc = useQueryClient()
  const [view, setView] = useState<View>('list')
  const [selected, setSelected] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK_Q)

  const { data: atData, isLoading: atLoading } = useQuery({
    queryKey: ['at-list-mp'],
    queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data),
  })

  const { data: poolStats } = useQuery({
    queryKey: ['pool-stats-mp', selected?.id],
    queryFn: () => questionsApi.getPoolStats(selected.id).then(r => r.data),
    enabled: !!selected && view === 'mcq',
  })

  const { data: qData, isLoading: qLoading } = useQuery({
    queryKey: ['questions-mp', selected?.id],
    queryFn: () => questionsApi.getAll({ assessmentTypeId: selected.id, limit: 500 }).then(r => r.data),
    enabled: !!selected && view === 'mcq',
  })

  const { data: ptData } = useQuery({
    queryKey: ['practical-mp', selected?.id],
    queryFn: () => practicalTasksApi.getAll({ assessmentTypeId: selected.id }).then(r => r.data),
    enabled: !!selected && view === 'practical',
  })

  const [editQuestion, setEditQuestion] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editReason, setEditReason] = useState('')

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => questionsApi.update(id, data),
    onSuccess: () => {
      toast.success('Question updated â€” change goes live immediately')
      qc.invalidateQueries({ queryKey: ['questions-mp', selected?.id] })
      setEditQuestion(null)
      setEditReason('')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => questionsApi.archive(id),
    onSuccess: () => { toast.success('Question archived'); qc.invalidateQueries({ queryKey: ['questions-mp', selected?.id] }) },
  })


  const addMutation = useMutation({    mutationFn: (payload: any) => questionsApi.create(payload),
    onSuccess: () => {
      toast.success('Question added')
      qc.invalidateQueries({ queryKey: ['questions-mp', selected?.id] })
      qc.invalidateQueries({ queryKey: ['pool-stats-mp', selected?.id] })
      setShowAdd(false)
      setForm(BLANK_Q)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to add question'),
  })

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selected) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('assessmentTypeId', selected.id)
    try {
      await questionsApi.bulkImport(fd)
      toast.success('CSV imported successfully')
      qc.invalidateQueries({ queryKey: ['questions-mp', selected?.id] })
      qc.invalidateQueries({ queryKey: ['pool-stats-mp', selected?.id] })
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'CSV import failed')
    }
    e.target.value = ''
  }

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault()
    addMutation.mutate({
      assessmentTypeId: selected.id,
      type: 'MCQ_SINGLE',
      content: { text: form.text },
      options: [
        { key: 'A', text: form.optA },
        { key: 'B', text: form.optB },
        { key: 'C', text: form.optC },
        { key: 'D', text: form.optD },
      ],
      correctAnswer: [form.correctAnswer],
      difficulty: form.difficulty,
      domain: form.domain,
      tags: [form.domain],
      marks: 1,
      language: 'en',
      status: 'ACTIVE',
    })
  }

  const atList: any[] = atData?.assessmentTypes || atData || []
  const mcqOnly = atList.filter(at => at.practicalType === 'NONE')
  const mcqPractical = atList.filter(at => at.practicalType !== 'NONE')
  const questions: any[] = qData?.questions || qData || []
  const practicalTasks: any[] = ptData?.practicalTasks || ptData || []

  const goBack = () => { setView('list'); setSelected(null); setShowAdd(false) }

  // â”€â”€ LIST VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (view === 'list') return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Question Papers</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Select an assessment to manage its MCQ or Practical paper</p>
      </div>

      {atLoading ? <p style={{ color: 'var(--text-muted)' }}>Loading assessments...</p> : (
        <>
          {/* MCQ Only */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <FileText size={18} color="var(--cyan)" />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>MCQ Paper Only</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '10px' }}>{mcqOnly.length}</span>
            </div>
            {!mcqOnly.length ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No MCQ-only assessments. Set Practical Type to NONE when creating an exam.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                {mcqOnly.map(at => (
                  <button key={at.id} onClick={() => { setSelected(at); setView('mcq') }}
                    style={{ padding: '18px', textAlign: 'left', cursor: 'pointer', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '10px', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{at.name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{at.shortCode} Â· {at.mcqQuestionCount} Qs Â· {at.mcqTimeLimit}min</p>
                    <span style={{ display: 'inline-block', marginTop: '10px', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(0,212,255,0.1)', color: 'var(--cyan)' }}>MCQ Paper â†’</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MCQ + Practical */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Code size={18} color="var(--emerald)" />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>MCQ + Practical Paper</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '10px' }}>{mcqPractical.length}</span>
            </div>
            {!mcqPractical.length ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No MCQ+Practical assessments configured yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                {mcqPractical.map(at => (
                  <div key={at.id} style={{ padding: '18px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{at.name}</p>
                    <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-muted)' }}>{at.shortCode} Â· {at.practicalType}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setSelected(at); setView('mcq') }}
                        className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                        MCQ Paper
                      </button>
                      <button onClick={() => { setSelected(at); setView('practical') }}
                        className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                        Practical
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  // â”€â”€ MCQ VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (view === 'mcq') return (
    <div>
      <button onClick={goBack} className="btn-ghost" style={{ marginBottom: '16px', padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <ArrowLeft size={13} /> Back to Question Papers
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{selected?.name} â€” MCQ Paper</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{selected?.shortCode} Â· {selected?.mcqQuestionCount} questions per exam Â· {selected?.mcqTimeLimit} min</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', fontSize: '14px' }}>
            <Upload size={14} /> Upload CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVUpload} />
          </label>
          <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Question
          </button>
        </div>
      </div>

      {/* Pool stats */}
      {poolStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Questions', value: poolStats.total, color: 'var(--cyan)' },
            { label: 'Active', value: poolStats.active, color: 'var(--emerald)' },
            { label: 'Pending Approval', value: poolStats.pendingApproval, color: 'var(--amber)' },
            { label: 'Pool Health', value: `${Math.min(100, Math.round(((poolStats.active || 0) / 500) * 100))}%`, color: (poolStats.active || 0) >= 500 ? 'var(--emerald)' : (poolStats.active || 0) >= 250 ? 'var(--amber)' : 'var(--rose)' },
          ].map(s => (
            <div key={s.label} className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* CSV format hint */}
      <div style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        CSV format: <code style={{ color: 'var(--cyan)' }}>question,option_a,option_b,option_c,option_d,correct_answer,difficulty,domain</code>
        &nbsp;â€” correct_answer should be A, B, C or D Â· difficulty: EASY / MEDIUM / HARD
      </div>

      {/* Questions table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>#</th><th>Question</th><th>Options</th><th>Answer</th><th>Domain</th><th>Difficulty</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {qLoading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !questions.length ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No questions yet. Add your first question or upload a CSV.</td></tr>
            ) : questions.map((q: any, i: number) => {
              const opts: any[] = q.options || []
              const correct = Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer
              return (
                <tr key={q.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{i + 1}</td>
                  <td style={{ maxWidth: '300px' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(q.content as any)?.text || 'â€”'}
                    </p>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {opts.map((o: any) => `${o.key}. ${o.text?.substring(0, 20)}${o.text?.length > 20 ? 'â€¦' : ''}`).join(' | ')}
                  </td>
                  <td>
                    <span style={{ fontWeight: '700', color: 'var(--emerald)', fontSize: '13px' }}>{correct}</span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{q.domain}</td>
                  <td>
                    <span className={`badge ${q.difficulty === 'EASY' ? 'badge-pass' : q.difficulty === 'MEDIUM' ? 'badge-pending' : 'badge-fail'}`} style={{ fontSize: '11px' }}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className={"btn-ghost"} style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--cyan)', borderColor: 'rgba(0,212,255,0.3)' }}
                        onClick={() => { setEditQuestion(q); setEditForm({ text: (q.content as any)?.text || '', optA: opts.find((o:any)=>o.key==='A')?.text||'', optB: opts.find((o:any)=>o.key==='B')?.text||'', optC: opts.find((o:any)=>o.key==='C')?.text||'', optD: opts.find((o:any)=>o.key==='D')?.text||'', correctAnswer: correct, difficulty: q.difficulty, domain: q.domain }); setEditReason('') }}>
                        Edit
                      </button>
                      <button className={"btn-ghost"} style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                        onClick={() => { if (window.confirm('Archive this question?')) archiveMutation.mutate(q.id) }}>
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>


      {/* Edit Question Modal */}
      {editQuestion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div className="glass-card" style={{ width: '660px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Edit Question</h2>
              <div style={{ padding: '6px 12px', background: 'rgba(225,29,72,0.1)', borderRadius: '6px', fontSize: '12px', color: 'var(--rose)' }}>
                Active â€” saves immediately
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Question Text *</label>
                <textarea className="form-input" rows={3} value={editForm.text} onChange={e => setEditForm((f: any) => ({ ...f, text: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {(['A', 'B', 'C', 'D'] as const).map(l => (
                  <div key={l}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Option {l}</label>
                    <input className="form-input" value={editForm[`opt${l}`] || ''} onChange={e => setEditForm((f: any) => ({ ...f, [`opt${l}`]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Correct Answer</label>
                  <select className="form-input" value={editForm.correctAnswer} onChange={e => setEditForm((f: any) => ({ ...f, correctAnswer: e.target.value }))}>
                    {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Difficulty</label>
                  <select className="form-input" value={editForm.difficulty} onChange={e => setEditForm((f: any) => ({ ...f, difficulty: e.target.value }))}>
                    {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Domain</label>
                  <input className="form-input" value={editForm.domain} onChange={e => setEditForm((f: any) => ({ ...f, domain: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Reason for Edit * (min 20 chars)</label>
                <textarea className="form-input" rows={2} value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="Explain why this question is being modified..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn-ghost" onClick={() => setEditQuestion(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }}
                disabled={editReason.trim().length < 20 || editMutation.isPending}
                onClick={() => editMutation.mutate({ id: editQuestion.id, data: { content: { text: editForm.text }, options: [{ key: 'A', text: editForm.optA }, { key: 'B', text: editForm.optB }, { key: 'C', text: editForm.optC }, { key: 'D', text: editForm.optD }], correctAnswer: [editForm.correctAnswer], difficulty: editForm.difficulty, domain: editForm.domain, editReason } })}>
                {editMutation.isPending ? 'Saving...' : 'Save Changes â€” Goes Live Immediately'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Question Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '660px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Add MCQ Question</h2>
            <form onSubmit={handleAddQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Question Text *</label>
                <textarea className="form-input" rows={3} required value={form.text}
                  onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                  placeholder="Enter the full question text..." style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {(['A', 'B', 'C', 'D'] as const).map(l => (
                  <div key={l}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Option {l} *</label>
                    <input className="form-input" required value={(form as any)[`opt${l}`]}
                      onChange={e => setForm(f => ({ ...f, [`opt${l}`]: e.target.value }))}
                      placeholder={`Option ${l}`} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Correct Answer *</label>
                  <select className="form-input" required value={form.correctAnswer} onChange={e => setForm(f => ({ ...f, correctAnswer: e.target.value }))}>
                    {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Difficulty *</label>
                  <select className="form-input" required value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                    {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Domain *</label>
                  <input className="form-input" required value={form.domain}
                    onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                    placeholder="e.g. Revit Basics" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => { setShowAdd(false); setForm(BLANK_Q) }} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={addMutation.isPending} style={{ flex: 1 }}>
                  {addMutation.isPending ? 'Adding...' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  // â”€â”€ PRACTICAL VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (view === 'practical') return (
    <div>
      <button onClick={goBack} className="btn-ghost" style={{ marginBottom: '16px', padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <ArrowLeft size={13} /> Back to Question Papers
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{selected?.name} â€” Practical Task</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{selected?.practicalType} Â· {selected?.practicalTimeLimit} minutes Â· Pass: {selected?.practicalPassThreshold}%</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> Add Practical Task
        </button>
      </div>

      {!practicalTasks.length ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '8px' }}>No practical tasks configured for this assessment.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Add a task with a brief description, starter file, and evaluation rubric.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {practicalTasks.map((pt: any) => (
            <div key={pt.id} className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{pt.title}</p>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>{pt.description?.substring(0, 120)}...</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge badge-pending">{pt.type}</span>
                    <span className="badge badge-pending">{pt.difficulty}</span>
                    {pt.starterFileName && <span className="badge badge-pass">ðŸ“Ž {pt.starterFileName}</span>}
                  </div>
                </div>
                <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: '13px' }}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return null
}
