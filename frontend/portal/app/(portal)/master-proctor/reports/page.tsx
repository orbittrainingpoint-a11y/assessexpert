'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { AlertTriangle, X } from 'lucide-react'

const REQUIRED_FIELD_OPTIONS = ['Proctor Narrative', 'Practical Quality Verdict', 'Overall Proctor Verdict', 'Specific AI score override', 'Other']
const OVERALL_VERDICTS = ['CLEAN', 'CLEAN_MINOR', 'FLAGGED', 'DISQUALIFIED']

export default function MasterProctorReportsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW')
  const [returnModal, setReturnModal] = useState<{ id: string; name: string } | null>(null)
  const [instructions, setInstructions] = useState('')
  const [requiredFields, setRequiredFields] = useState<string[]>([])
  const [overrideModal, setOverrideModal] = useState<any>(null)
  const [overrideNarrative, setOverrideNarrative] = useState('')
  const [overrideVerdict, setOverrideVerdict] = useState('')
  const [overrideJustification, setOverrideJustification] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['mp-reports', statusFilter],
    queryFn: () => reportsApi.getAll({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
  })

  const returnMutation = useMutation({
    mutationFn: () => reportsApi.returnForModification(
      returnModal!.id,
      `${instructions}\n\nRequired fields: ${requiredFields.join(', ')}`
    ),
    onSuccess: () => {
      toast.success('Report returned for modification')
      setReturnModal(null); setInstructions(''); setRequiredFields([])
      qc.invalidateQueries({ queryKey: ['mp-reports'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const overrideMutation = useMutation({
    mutationFn: async () => {
      await reportsApi.updateProctorFields(overrideModal.sessionId, {
        narrative: overrideNarrative,
        overallVerdict: overrideVerdict,
        overrideJustification,
      })
      await reportsApi.publish(overrideModal.sessionId)
    },
    onSuccess: () => {
      toast.success('Report overridden and republished')
      setOverrideModal(null)
      qc.invalidateQueries({ queryKey: ['mp-reports'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const toggleField = (f: string) =>
    setRequiredFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  const list: any[] = data?.reports || data || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Report Review</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Oversee all assessment reports</p>
        </div>
        <select className="form-input" style={{ width: '200px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['DRAFT', 'PENDING_REVIEW', 'RETURNED', 'PUBLISHED'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Candidate</th><th>Assessment</th><th>Company</th><th>MCQ</th><th>Overall</th><th>Result</th><th>Integrity</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !list.length ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No reports found.</td></tr>
            ) : list.map((r: any) => (
              <tr key={r.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                  {r.session?.candidate?.firstName} {r.session?.candidate?.lastName}
                </td>
                <td style={{ fontSize: '13px' }}>{r.session?.assessmentType?.name}</td>
                <td style={{ fontSize: '13px' }}>{r.organization?.name || r.session?.organization?.name}</td>
                <td>{r.mcqScore?.toFixed(1)}%</td>
                <td style={{ fontWeight: '600' }}>{r.overallScore?.toFixed(1)}%</td>
                <td><span className={`badge ${r.overallPassed ? 'badge-pass' : 'badge-fail'}`}>{r.overallPassed ? 'PASS' : 'FAIL'}</span></td>
                <td style={{ color: (r.integrityScore || 0) >= 90 ? 'var(--emerald)' : (r.integrityScore || 0) >= 75 ? 'var(--amber)' : 'var(--rose)', fontWeight: '600' }}>
                  {r.integrityScore?.toFixed(0)}/100
                </td>
                <td>
                  <span className={`badge ${r.status === 'PUBLISHED' ? 'badge-pass' : r.status === 'PENDING_REVIEW' ? 'badge-pending' : r.status === 'RETURNED' ? 'badge-fail' : 'badge-draft'}`}>
                    {r.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Link href={`/proctor/reports/${r.sessionId}`} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none' }}>View</Link>
                    {r.status === 'PENDING_REVIEW' && (
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--amber)', borderColor: 'rgba(215,119,6,0.3)' }}
                        onClick={() => { setReturnModal({ id: r.id, name: `${r.session?.candidate?.firstName} ${r.session?.candidate?.lastName}` }); setRequiredFields([]) }}>
                        Return
                      </button>
                    )}
                    {['PENDING_REVIEW', 'RETURNED'].includes(r.status) && (
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                        onClick={() => { setOverrideModal(r); setOverrideNarrative(r.proctorNarrative || ''); setOverrideVerdict(r.overallVerdict || '') }}>
                        Override
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RETURN MODAL */}
      {returnModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '520px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Return for Modification</h2>
              <button onClick={() => setReturnModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{returnModal.name}</p>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Required fields to revise:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {REQUIRED_FIELD_OPTIONS.map(f => (
                  <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: requiredFields.includes(f) ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    <input type="checkbox" checked={requiredFields.includes(f)} onChange={() => toggleField(f)} style={{ accentColor: 'var(--cyan)' }} />
                    {f}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Instructions for Proctor *</label>
              <textarea className="form-input" rows={4} value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder="Explain what needs to be corrected..." style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn-ghost" onClick={() => setReturnModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={() => returnMutation.mutate()}
                disabled={!instructions.trim() || returnMutation.isPending} style={{ flex: 1 }}>
                {returnMutation.isPending ? 'Returning...' : 'Return Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERRIDE MODAL */}
      {overrideModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '560px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <AlertTriangle size={20} color="var(--rose)" />
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Escalation Override</h2>
            </div>
            <div style={{ padding: '10px 14px', background: 'rgba(225,29,72,0.08)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--rose)', border: '1px solid rgba(225,29,72,0.2)' }}>
              This will modify and republish the report directly. The proctor and Admin will be notified. This action is fully audited.
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {overrideModal.session?.candidate?.firstName} {overrideModal.session?.candidate?.lastName} · {overrideModal.session?.assessmentType?.name}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Overall Verdict</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {OVERALL_VERDICTS.map(v => (
                    <button key={v} type="button" onClick={() => setOverrideVerdict(v)}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${overrideVerdict === v ? 'var(--cyan)' : 'var(--border)'}`, background: overrideVerdict === v ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: overrideVerdict === v ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                      {v.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Proctor Narrative (override)</label>
                <textarea className="form-input" rows={4} value={overrideNarrative} onChange={e => setOverrideNarrative(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Justification * (min 20 chars)</label>
                <textarea className="form-input" rows={3} value={overrideJustification} onChange={e => setOverrideJustification(e.target.value)}
                  placeholder="Explain why this escalation override is necessary..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn-ghost" onClick={() => setOverrideModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--rose)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: overrideJustification.trim().length < 20 ? 'not-allowed' : 'pointer', opacity: overrideJustification.trim().length < 20 ? 0.5 : 1 }}
                disabled={overrideJustification.trim().length < 20 || overrideMutation.isPending}
                onClick={() => overrideMutation.mutate()}>
                {overrideMutation.isPending ? 'Overriding...' : 'Confirm Override & Republish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
