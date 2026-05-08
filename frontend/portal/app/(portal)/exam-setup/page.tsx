'use client'
import { useQuery } from '@tanstack/react-query'
import { assessmentsApi, questionsApi } from '@/lib/api'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ExamSetupDashboard() {
  const router = useRouter()

  const { data: atData } = useQuery({
    queryKey: ['exam-setup-at'],
    queryFn: () => assessmentsApi.getAll({ limit: 200 }).then(r => r.data),
  })

  const { data: poolData } = useQuery({
    queryKey: ['exam-setup-pool'],
    queryFn: () => questionsApi.getAll({ limit: 1, status: 'ACTIVE' }).then(r => r.data),
  })

  const { data: draftData } = useQuery({
    queryKey: ['exam-setup-draft'],
    queryFn: () => questionsApi.getAll({ limit: 1, status: 'DRAFT' }).then(r => r.data),
  })

  const { data: pendingData } = useQuery({
    queryKey: ['exam-setup-pending'],
    queryFn: () => questionsApi.getAll({ limit: 1, status: 'PENDING_APPROVAL' }).then(r => r.data),
  })

  const atList: any[] = atData?.assessmentTypes || atData || []
  const activeTypes = atList.filter((a: any) => a.status === 'ACTIVE').length
  const totalMCQ = poolData?.total ?? poolData?.count ?? 0
  const draftMCQ = draftData?.total ?? draftData?.count ?? 0
  const pendingApproval = pendingData?.total ?? pendingData?.count ?? 0

  // Health logic per assessment type
  const getHealth = (at: any) => {
    const active = at.activeQuestions ?? at._count?.questions ?? 0
    const min = (at.mcqQuestionCount ?? 25) * 2
    if (active === 0 && !at.mcqQuestionCount) return 'good'
    if (active >= min) return 'good'
    if (active >= min * 0.8) return 'review'
    return 'below'
  }

  const healthIcon = { good: '🟢', review: '🟡', below: '🔴' }
  const healthLabel = { good: 'Good', review: 'Needs Review', below: 'Below Minimum' }

  const statCards = [
    { label: 'Active Assessment Types', value: activeTypes, color: 'var(--cyan)' },
    { label: 'Total Active MCQs', value: totalMCQ, color: 'var(--emerald)' },
    { label: 'Draft MCQs', value: draftMCQ, color: 'var(--amber)' },
    { label: 'Pending Review', value: draftMCQ, color: 'var(--amber)' },
    { label: 'Pending Approval', value: pendingApproval, color: 'var(--rose)' },
  ]

  // Recent activity (static demo — real impl needs audit log API)
  const recentActivity = [
    { text: 'Question #847 updated — BIM Coordinator L2', time: '14 Jun, 09:34 AM' },
    { text: 'Practical Task #12 uploaded — Python Developer', time: '13 Jun, 04:15 PM' },
    { text: '5 questions archived — Network Engineer', time: '12 Jun, 02:00 PM' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Exam Setup Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Content health overview across all assessment types</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {statCards.map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Health Table */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Assessment Type Pool Health</h3>
            <Link href="/exam-setup/questions" style={{ fontSize: '13px', color: 'var(--cyan)', textDecoration: 'none' }}>Manage Questions →</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Assessment Type</th>
                <th>Category</th>
                <th>Active MCQs</th>
                <th>Draft</th>
                <th>Min Required</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {!atList.length ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No assessment types found</td></tr>
              ) : atList.map((at: any) => {
                const h = getHealth(at)
                const active = at.activeQuestions ?? at._count?.questions ?? '—'
                const draft = at.draftQuestions ?? '—'
                const min = at.mcqQuestionCount ? at.mcqQuestionCount * 2 : '—'
                return (
                  <tr key={at.id} style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/exam-setup/questions?assessmentTypeId=${at.id}`)}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{at.name}</td>
                    <td style={{ fontSize: '12px' }}>{at.category}</td>
                    <td style={{ textAlign: 'center', color: 'var(--emerald)', fontWeight: '600' }}>{active}</td>
                    <td style={{ textAlign: 'center', color: 'var(--amber)' }}>{draft}</td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>{min}</td>
                    <td>
                      <span style={{ fontSize: '13px' }}>{healthIcon[h]} {healthLabel[h]}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Recent Activity */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentActivity.map((a, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', borderLeft: '3px solid var(--cyan)' }}>
                <p style={{ margin: '0 0 3px', fontSize: '13px', color: 'var(--text-primary)' }}>{a.text}</p>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{a.time}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Health Legend</p>
            {(['good', 'review', 'below'] as const).map(h => (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px' }}>{healthIcon[h]}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{healthLabel[h]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
