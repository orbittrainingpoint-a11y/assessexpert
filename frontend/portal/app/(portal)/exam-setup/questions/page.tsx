'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionsApi, assessmentsApi } from '@/lib/api'
import { Plus, Upload, Archive } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const BLANK = { type: 'MCQ_SINGLE', content: { text: '' }, options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }], correctAnswer: ['A'], difficulty: 'MEDIUM', domain: '', tags: '', marks: 1 }

function QuestionsContent() {
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const [assessmentTypeId, setAssessmentTypeId] = useState(searchParams.get('assessmentTypeId') || '')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)

  const { data: atData } = useQuery({ queryKey: ['at-list-esm'], queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data) })
  const { data: poolStats } = useQuery({
    queryKey: ['pool-stats-esm', assessmentTypeId],
    queryFn: () => assessmentTypeId ? questionsApi.getPoolStats(assessmentTypeId).then(r => r.data) : null,
    enabled: !!assessmentTypeId,
  })
  const { data, isLoading } = useQuery({
    queryKey: ['questions-esm', assessmentTypeId],
    queryFn: () => questionsApi.getAll({ assessmentTypeId: assessmentTypeId || undefined, limit: 500 }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => questionsApi.create({ ...d, assessmentTypeId, tags: d.tags ? d.tags.split(',').map((t: string) => t.trim()) : [] }),
    onSuccess: () => { toast.success('Question created'); qc.invalidateQueries({ queryKey: ['questions-esm'] }); setShowAdd(false); setForm(BLANK) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => questionsApi.archive(id),
    onSuccess: () => { toast.success('Question archived'); qc.invalidateQueries({ queryKey: ['questions-esm'] }) },
  })

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    if (assessmentTypeId) fd.append('assessmentTypeId', assessmentTypeId)
    try {
      const { data } = await questionsApi.bulkImport(fd)
      toast.success(`Imported ${data.success} questions`)
      qc.invalidateQueries({ queryKey: ['questions-esm'] })
    } catch { toast.error('Import failed') }
    e.target.value = ''
  }

  const atList = atData?.assessmentTypes || atData || []
  const questions = data?.questions || data || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>MCQ Question Bank</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Target: 500 active questions per assessment type</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" accept=".csv,.xlsx" onChange={handleImport} style={{ display: 'none' }} />
            <span className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', cursor: 'pointer' }}>
              <Upload size={15} /> Import CSV
            </span>
          </label>
          <button className="btn-primary" onClick={() => setShowAdd(true)} disabled={!assessmentTypeId} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: assessmentTypeId ? 1 : 0.5 }}>
            <Plus size={15} /> Add Question
          </button>
        </div>
      </div>

      <select className="form-input" style={{ width: '320px', marginBottom: '16px' }} value={assessmentTypeId} onChange={e => setAssessmentTypeId(e.target.value)}>
        <option value="">Select Assessment Type</option>
        {Array.isArray(atList) && atList.map((at: any) => <option key={at.id} value={at.id}>{at.name}</option>)}
      </select>

      {poolStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total', value: poolStats.total },
            { label: 'Active', value: poolStats.active, color: poolStats.active >= 500 ? 'var(--emerald)' : 'var(--amber)' },
            { label: 'Pending', value: poolStats.pendingApproval },
            { label: 'Target', value: '500', color: 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label} className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: (s as any).color || 'var(--cyan)' }}>{s.value}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>#</th><th>Question</th><th>Domain</th><th>Difficulty</th><th>Status</th><th>Used</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {!assessmentTypeId ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Select an assessment type above.</td></tr>
            ) : isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !Array.isArray(questions) || !questions.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No questions yet. Add your first question.</td></tr>
            ) : questions.map((q: any, i: number) => (
              <tr key={q.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{i + 1}</td>
                <td style={{ maxWidth: '380px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(q.content as any)?.text || 'No text'}
                  </p>
                </td>
                <td style={{ fontSize: '12px' }}>{q.domain}</td>
                <td><span className={`badge ${q.difficulty === 'EASY' ? 'badge-pass' : q.difficulty === 'MEDIUM' ? 'badge-pending' : 'badge-fail'}`} style={{ fontSize: '11px' }}>{q.difficulty}</span></td>
                <td><span className={`badge ${q.status === 'ACTIVE' ? 'badge-pass' : q.status === 'PENDING_APPROVAL' ? 'badge-pending' : 'badge-draft'}`} style={{ fontSize: '11px' }}>{q.status.replace(/_/g, ' ')}</span></td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{q.usageCount}×</td>
                <td>
                  {q.status !== 'ARCHIVED' && (
                    <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => { if (confirm('Archive this question?')) archiveMutation.mutate(q.id) }}>
                      <Archive size={12} /> Archive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '620px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Add MCQ Question</h2>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Question Text *</label>
                <textarea className="form-input" rows={3} required value={form.content.text} onChange={e => setForm(f => ({ ...f, content: { text: e.target.value } }))} style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Answer Options *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {form.options.map((opt, idx) => (
                    <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="radio" name="correct" checked={form.correctAnswer[0] === opt.key} onChange={() => setForm(f => ({ ...f, correctAnswer: [opt.key] }))} />
                      <span style={{ color: 'var(--cyan)', fontWeight: '600', width: '20px' }}>{opt.key}</span>
                      <input className="form-input" style={{ flex: 1 }} required value={opt.text} onChange={e => setForm(f => ({ ...f, options: f.options.map((o, i) => i === idx ? { ...o, text: e.target.value } : o) }))} placeholder={`Option ${opt.key}`} />
                    </div>
                  ))}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Select the radio button next to the correct answer.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Difficulty</label>
                  <select className="form-input" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                    {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Domain *</label>
                  <input className="form-input" required value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="e.g. Revit Fundamentals" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Marks</label>
                  <input className="form-input" type="number" value={form.marks} onChange={e => setForm(f => ({ ...f, marks: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Tags (comma-separated)</label>
                <input className="form-input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="tag1, tag2" />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending} style={{ flex: 1 }}>
                  {createMutation.isPending ? 'Saving...' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExamSetupQuestionsPage() {
  return <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>}><QuestionsContent /></Suspense>
}
