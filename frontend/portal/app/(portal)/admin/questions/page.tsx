'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { questionsApi, assessmentsApi } from '@/lib/api'

export default function AdminQuestionsPage() {
  const [assessmentTypeId, setAssessmentTypeId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: atData } = useQuery({ queryKey: ['at-list'], queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data) })
  const { data, isLoading } = useQuery({
    queryKey: ['questions-admin', assessmentTypeId, statusFilter],
    queryFn: () => questionsApi.getAll({ assessmentTypeId: assessmentTypeId || undefined, status: statusFilter || undefined, limit: 200 }).then(r => r.data),
  })

  const { data: poolStats } = useQuery({
    queryKey: ['pool-stats', assessmentTypeId],
    queryFn: () => assessmentTypeId ? questionsApi.getPoolStats(assessmentTypeId).then(r => r.data) : null,
    enabled: !!assessmentTypeId,
  })

  const atList = atData?.assessmentTypes || atData || []
  const questions = data?.questions || data || []

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Question Bank</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Platform-wide question pool overview</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <select className="form-input" style={{ width: '280px' }} value={assessmentTypeId} onChange={e => setAssessmentTypeId(e.target.value)}>
          <option value="">All Assessment Types</option>
          {Array.isArray(atList) && atList.map((at: any) => <option key={at.id} value={at.id}>{at.name}</option>)}
        </select>
        <select className="form-input" style={{ width: '180px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'ARCHIVED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {poolStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Questions', value: poolStats.total },
            { label: 'Active', value: poolStats.active },
            { label: 'Pending Approval', value: poolStats.pendingApproval },
            { label: 'Target (500)', value: `${poolStats.active}/500`, color: poolStats.active >= 500 ? 'var(--emerald)' : 'var(--amber)' },
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
            <tr><th>#</th><th>Question</th><th>Assessment Type</th><th>Domain</th><th>Difficulty</th><th>Type</th><th>Status</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !Array.isArray(questions) || !questions.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No questions found.</td></tr>
            ) : questions.map((q: any, i: number) => (
              <tr key={q.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{i + 1}</td>
                <td style={{ color: 'var(--text-primary)', maxWidth: '400px' }}>
                  <p style={{ margin: 0, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(q.content as any)?.text || 'No text'}
                  </p>
                </td>
                <td style={{ fontSize: '12px' }}>{q.assessmentType?.name}</td>
                <td style={{ fontSize: '12px' }}>{q.domain}</td>
                <td><span className={`badge ${q.difficulty === 'EASY' ? 'badge-pass' : q.difficulty === 'MEDIUM' ? 'badge-pending' : 'badge-fail'}`} style={{ fontSize: '11px' }}>{q.difficulty}</span></td>
                <td style={{ fontSize: '12px' }}>{q.type.replace(/_/g, ' ')}</td>
                <td><span className={`badge ${q.status === 'ACTIVE' ? 'badge-pass' : q.status === 'PENDING_APPROVAL' ? 'badge-pending' : 'badge-draft'}`} style={{ fontSize: '11px' }}>{q.status.replace(/_/g, ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
