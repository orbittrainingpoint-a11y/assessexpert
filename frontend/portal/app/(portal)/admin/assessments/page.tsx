'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assessmentsApi } from '@/lib/api'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

const BLANK = { name: '', shortCode: '', category: '', industry: '', jobRole: '', description: '', mcqTimeLimit: 30, mcqQuestionCount: 25, mcqPassThreshold: 60, practicalType: 'FILE', practicalTimeLimit: 60, practicalPassThreshold: 60 }

export default function AdminAssessmentsPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-types-admin'],
    queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => assessmentsApi.create(d),
    onSuccess: () => { toast.success('Assessment type created'); qc.invalidateQueries({ queryKey: ['assessment-types-admin'] }); setShowAdd(false); setForm(BLANK) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const list = data?.assessmentTypes || data || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Assessment Types</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{Array.isArray(list) ? list.length : 0} types configured</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> New Assessment Type
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Code</th><th>Category</th><th>Industry</th><th>MCQ Time</th><th>Practical</th><th>Status</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !Array.isArray(list) || !list.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No assessment types yet.</td></tr>
            ) : list.map((at: any) => (
              <tr key={at.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{at.name}</td>
                <td><code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: 'var(--cyan)' }}>{at.shortCode}</code></td>
                <td>{at.category}</td>
                <td>{at.industry}</td>
                <td>{at.mcqTimeLimit} min · {at.mcqQuestionCount} Qs</td>
                <td>{at.practicalType} · {at.practicalTimeLimit} min</td>
                <td><span className={`badge ${at.status === 'ACTIVE' ? 'badge-pass' : at.status === 'DRAFT' ? 'badge-draft' : 'badge-fail'}`}>{at.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '580px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>New Assessment Type</h2>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[['name', 'Name *', true], ['shortCode', 'Short Code *', true], ['category', 'Category *', true], ['industry', 'Industry *', true], ['jobRole', 'Job Role *', true]].map(([k, l, req]) => (
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
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
