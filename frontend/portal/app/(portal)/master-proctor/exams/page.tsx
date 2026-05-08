'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assessmentsApi } from '@/lib/api'
import { Plus, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

const BLANK = { name: '', shortCode: '', category: '', industry: '', jobRole: '', description: '', mcqTimeLimit: 30, mcqQuestionCount: 25, mcqPassThreshold: 60, practicalType: 'FILE', practicalTimeLimit: 60, practicalPassThreshold: 60 }

export default function MasterProctorExamsPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)

  const { data, isLoading } = useQuery({
    queryKey: ['mp-exams'],
    queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => assessmentsApi.create(d),
    onSuccess: () => { toast.success('Exam created'); qc.invalidateQueries({ queryKey: ['mp-exams'] }); setShowAdd(false); setForm(BLANK) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => assessmentsApi.update(id, data),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['mp-exams'] }) },
  })

  const list = data?.assessmentTypes || data || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Create & Manage Exams</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Configure assessment types and exam parameters</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> New Exam
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Exams', value: Array.isArray(list) ? list.length : 0 },
          { label: 'Active', value: Array.isArray(list) ? list.filter((a: any) => a.status === 'ACTIVE').length : 0 },
          { label: 'Draft', value: Array.isArray(list) ? list.filter((a: any) => a.status === 'DRAFT').length : 0 },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: 'var(--cyan)' }}>{s.value}</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {isLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>
        ) : !Array.isArray(list) || !list.length ? (
          <div style={{ color: 'var(--text-muted)', padding: '40px' }}>No exams configured yet.</div>
        ) : list.map((at: any) => (
          <div key={at.id} className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BookOpen size={18} color="var(--cyan)" />
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{at.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{at.shortCode} · {at.category}</p>
                </div>
              </div>
              <span className={`badge ${at.status === 'ACTIVE' ? 'badge-pass' : at.status === 'DRAFT' ? 'badge-draft' : 'badge-fail'}`}>{at.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {[
                { label: 'MCQ', value: `${at.mcqTimeLimit}min · ${at.mcqQuestionCount}Qs` },
                { label: 'Practical', value: `${at.practicalType} · ${at.practicalTimeLimit}min` },
                { label: 'Pass', value: `${at.mcqPassThreshold}%` },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--bg-elevated)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{m.value}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{m.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {at.status === 'DRAFT' && (
                <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                  onClick={() => updateMutation.mutate({ id: at.id, data: { status: 'ACTIVE' } })}>
                  Activate
                </button>
              )}
              {at.status === 'ACTIVE' && (
                <button className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                  onClick={() => updateMutation.mutate({ id: at.id, data: { status: 'ARCHIVED' } })}>
                  Archive
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '580px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Create New Exam</h2>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[['name', 'Exam Name *', true], ['shortCode', 'Short Code *', true], ['category', 'Category *', true], ['industry', 'Industry *', true], ['jobRole', 'Job Role *', true]].map(([k, l, req]) => (
                  <div key={k as string}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{l as string}</label>
                    <input className="form-input" required={req as boolean} value={(form as any)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Practical Type</label>
                  <select className="form-input" value={form.practicalType} onChange={e => setForm(f => ({ ...f, practicalType: e.target.value }))}>
                    {['CAD', 'CODING', 'LAB', 'FILE', 'NONE'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[['mcqTimeLimit', 'MCQ Time (min)'], ['mcqQuestionCount', 'MCQ Questions'], ['mcqPassThreshold', 'MCQ Pass %'], ['practicalTimeLimit', 'Practical Time (min)'], ['practicalPassThreshold', 'Practical Pass %']].map(([k, l]) => (
                  <div key={k as string}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{l as string}</label>
                    <input className="form-input" type="number" value={(form as any)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: parseFloat(e.target.value) }))} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description</label>
                <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending} style={{ flex: 1 }}>
                  {createMutation.isPending ? 'Creating...' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
