'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { practicalTasksApi, assessmentsApi } from '@/lib/api'
import { Plus, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

const BLANK = { assessmentTypeId: '', type: 'FILE', title: '', description: '', difficulty: 'STANDARD', estimatedMinutes: 60, acceptedFileTypes: ['.pdf', '.docx'], rubricData: {} }

export default function ExamSetupPracticalPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)

  const { data: atData } = useQuery({ queryKey: ['at-list-prac'], queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data) })
  const { data, isLoading } = useQuery({
    queryKey: ['practical-tasks'],
    queryFn: () => practicalTasksApi.getAll({ limit: 200 }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => practicalTasksApi.create(d),
    onSuccess: () => { toast.success('Practical task created'); qc.invalidateQueries({ queryKey: ['practical-tasks'] }); setShowAdd(false); setForm(BLANK) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => practicalTasksApi.activate(id),
    onSuccess: () => {
      toast.success('Task activated — now assignable to candidates and visible in the simulator')
      qc.invalidateQueries({ queryKey: ['practical-tasks'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to activate'),
  })

  const atList = atData?.assessmentTypes || atData || []
  const tasks = data?.tasks || data || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Practical Task Library</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{Array.isArray(tasks) ? tasks.length : 0} tasks configured</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> Add Task
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Assessment Type</th><th>Type</th><th>Difficulty</th><th>Est. Time</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !Array.isArray(tasks) || !tasks.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No practical tasks yet.</td></tr>
            ) : tasks.map((t: any) => (
              <tr key={t.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{t.title}</td>
                <td style={{ fontSize: '13px' }}>{t.assessmentType?.name}</td>
                <td><span className="badge badge-live" style={{ fontSize: '11px' }}>{t.type}</span></td>
                <td style={{ fontSize: '13px' }}>{t.difficulty}</td>
                <td style={{ fontSize: '13px' }}>{t.estimatedMinutes} min</td>
                <td><span className={`badge ${t.status === 'ACTIVE' ? 'badge-pass' : t.status === 'DRAFT' ? 'badge-draft' : 'badge-fail'}`}>{t.status}</span></td>
                <td>
                  {t.status === 'DRAFT' && (
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--emerald)', borderColor: 'rgba(5,150,105,0.4)' }}
                      onClick={() => activateMutation.mutate(t.id)}
                      disabled={activateMutation.isPending}
                      aria-label={`Activate ${t.title}`}
                    >
                      <CheckCircle2 size={12} /> Activate
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
          <div className="glass-card" style={{ width: '560px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Add Practical Task</h2>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Assessment Type *</label>
                <select className="form-input" required value={form.assessmentTypeId} onChange={e => setForm(f => ({ ...f, assessmentTypeId: e.target.value }))}>
                  <option value="">Select...</option>
                  {Array.isArray(atList) && atList.map((at: any) => <option key={at.id} value={at.id}>{at.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Task Type</label>
                  <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {['CAD', 'CODING', 'LAB', 'FILE'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Difficulty</label>
                  <select className="form-input" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                    {['STANDARD', 'ADVANCED', 'EXPERT'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Title *</label>
                <input className="form-input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description / Instructions *</label>
                <textarea className="form-input" rows={4} required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Estimated Minutes</label>
                <input className="form-input" type="number" value={form.estimatedMinutes} onChange={e => setForm(f => ({ ...f, estimatedMinutes: parseInt(e.target.value) }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending} style={{ flex: 1 }}>
                  {createMutation.isPending ? 'Saving...' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
