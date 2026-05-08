'use client'
import { useQuery } from '@tanstack/react-query'
import { assessmentsApi } from '@/lib/api'
import Link from 'next/link'

export default function ExamSetupAssessmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['esm-assessments'],
    queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data),
  })

  const list = data?.assessmentTypes || data || []

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Assessment Types</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>All configured assessment types and their question pool health</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {isLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>
        ) : !Array.isArray(list) || !list.length ? (
          <div style={{ color: 'var(--text-muted)', padding: '40px' }}>No assessment types found.</div>
        ) : list.map((at: any) => (
          <div key={at.id} className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{at.name}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{at.shortCode} · {at.category} · {at.industry}</p>
              </div>
              <span className={`badge ${at.status === 'ACTIVE' ? 'badge-pass' : at.status === 'DRAFT' ? 'badge-draft' : 'badge-fail'}`}>{at.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {[
                { label: 'MCQ', value: `${at.mcqTimeLimit}min` },
                { label: 'Questions', value: at.mcqQuestionCount },
                { label: 'Pass', value: `${at.mcqPassThreshold}%` },
                { label: 'Practical', value: at.practicalType },
                { label: 'Prac. Time', value: `${at.practicalTimeLimit}min` },
                { label: 'Prac. Pass', value: `${at.practicalPassThreshold}%` },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--bg-elevated)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{m.value}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{m.label}</p>
                </div>
              ))}
            </div>
            <Link href={`/exam-setup/questions?assessmentTypeId=${at.id}`} className="btn-ghost" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '8px', fontSize: '13px' }}>
              Manage Questions →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
