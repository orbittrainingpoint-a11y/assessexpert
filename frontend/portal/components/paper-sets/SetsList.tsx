'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { practicalSetsApi } from '@/lib/api'
import { Plus, Layers } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  /** Optional — when provided, lists only paper sets for this assessment type
   *  and pre-fills the assessment field in the create dialog. */
  assessmentTypeId?: string
  /** Optional — when provided, hides the "Assessment" dropdown in the create
   *  dialog because the parent already knows which one to use. */
  lockAssessment?: { id: string; name: string }
  /** Optional list of all assessment types (only needed when lockAssessment is
   *  NOT set, i.e. on the standalone /paper-sets page). */
  assessmentTypes?: any[]
  /** Called when the user clicks a set card. Parent decides what view to show. */
  onOpenSet: (setId: string) => void
}

export function SetsList({ assessmentTypeId, lockAssessment, assessmentTypes = [], onOpenSet }: Props) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<{ assessmentTypeId: string; name: string; description: string }>(
    { assessmentTypeId: lockAssessment?.id || assessmentTypeId || '', name: '', description: '' },
  )

  const { data: setsData } = useQuery({
    queryKey: ['paper-sets', assessmentTypeId || 'all'],
    queryFn: () => practicalSetsApi.list(assessmentTypeId).then(r => r.data),
  })
  const sets: any[] = setsData || []
  const atOptions = assessmentTypes.filter(at => at.practicalType && at.practicalType !== 'NONE')

  const createMutation = useMutation({
    mutationFn: (body: any) => practicalSetsApi.create(body),
    onSuccess: (r) => {
      toast.success('Paper set created')
      qc.invalidateQueries({ queryKey: ['paper-sets'] })
      setShowCreate(false)
      setCreateForm({ assessmentTypeId: lockAssessment?.id || assessmentTypeId || '', name: '', description: '' })
      onOpenSet(r.data.id)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create'),
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {lockAssessment ? `${lockAssessment.name} — Practical Paper Sets` : 'Practical Paper Sets'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Build numbered sets (Set 1, Set 2…) — each with its own file library and ordered questions. Proctor picks one per candidate at exam time.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> New Paper Set
        </button>
      </div>

      {sets.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No paper sets yet. Click "New Paper Set" to create your first one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {sets.map(s => (
            <div key={s.id} className="glass-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="var(--cyan)" />
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</p>
                </div>
                <span className={`badge ${s.status === 'ACTIVE' ? 'badge-pass' : 'badge-pending'}`} style={{ fontSize: '10px' }}>{s.status}</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {s.assessmentType?.name} · {s._count?.questions || 0} questions · {s._count?.files || 0} files
              </p>
              {s.description && <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{s.description}</p>}
              <button type="button" className="btn-primary" style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                onClick={() => onOpenSet(s.id)}>
                Manage Set →
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div className="glass-card" style={{ width: '500px', padding: '24px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', color: 'var(--text-primary)' }}>New Paper Set</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {lockAssessment ? (
                <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Assessment: <strong style={{ color: 'var(--text-primary)' }}>{lockAssessment.name}</strong>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Assessment *</label>
                  <select className="form-input" value={createForm.assessmentTypeId} onChange={e => setCreateForm(f => ({ ...f, assessmentTypeId: e.target.value }))}>
                    <option value="">Select assessment with practical</option>
                    {atOptions.map(at => <option key={at.id} value={at.id}>{at.name} · {at.practicalType}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Set Name *</label>
                <input className="form-input" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Set 1" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description (optional)</label>
                <textarea className="form-input" rows={2} value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Floor plan + section drawing" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }}
                disabled={!createForm.assessmentTypeId || !createForm.name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(createForm)}>
                {createMutation.isPending ? 'Creating...' : 'Create Set'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
