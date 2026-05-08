'use client'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import Link from 'next/link'
import { FileText, Clock } from 'lucide-react'

export default function ProctorReportsPage() {
  const { data: pending, isLoading: loadingPending } = useQuery({
    queryKey: ['proctor-reports-pending'],
    queryFn: () => reportsApi.getAll({ status: 'PENDING_PROCTOR_REVIEW', limit: 100 }).then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: published, isLoading: loadingPublished } = useQuery({
    queryKey: ['proctor-reports-published'],
    queryFn: () => reportsApi.getAll({ status: 'PUBLISHED', limit: 100 }).then(r => r.data),
  })

  const pendingList: any[] = pending?.reports || pending || []
  const publishedList: any[] = published?.reports || published || []

  const integrityColor = (score: number) =>
    score >= 90 ? 'var(--emerald)' : score >= 75 ? 'var(--amber)' : 'var(--rose)'

  const ReportRow = ({ r }: { r: any }) => (
    <tr key={r.id}>
      <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
        {r.session?.candidate?.firstName} {r.session?.candidate?.lastName}
      </td>
      <td style={{ fontSize: '13px' }}>{r.session?.assessmentType?.name}</td>
      <td style={{ fontSize: '13px' }}>{r.session?.organization?.name}</td>
      <td style={{ fontSize: '13px' }}>{r.mcqScore?.toFixed(1)}%</td>
      <td style={{ fontWeight: '600' }}>{r.overallScore?.toFixed(1)}%</td>
      <td>
        <span className={`badge ${r.overallPassed ? 'badge-pass' : 'badge-fail'}`}>
          {r.overallPassed ? 'PASS' : 'FAIL'}
        </span>
      </td>
      <td style={{ color: integrityColor(r.integrityScore || 0), fontWeight: '600' }}>
        {r.integrityScore?.toFixed(0)}/100
      </td>
      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : '—'}
      </td>
      <td>
        <Link
          href={`/proctor/reports/${r.sessionId}`}
          className="btn-ghost"
          style={{ padding: '5px 10px', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <FileText size={12} />
          {r.status === 'PENDING_PROCTOR_REVIEW' ? 'Review' : 'View'}
        </Link>
      </td>
    </tr>
  )

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          Assessment Reports
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Review and publish candidate assessment reports
        </p>
      </div>

      {/* Pending Review */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderLeft: '3px solid var(--amber)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Clock size={16} color="var(--amber)" />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Pending Review
          </h3>
          <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(215,119,6,0.15)', color: 'var(--amber)', fontSize: '12px', fontWeight: '600' }}>
            {pendingList.length}
          </span>
        </div>

        {loadingPending ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading...</p>
        ) : !pendingList.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No reports pending review.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th><th>Assessment</th><th>Company</th>
                <th>MCQ</th><th>Overall</th><th>Result</th>
                <th>Integrity</th><th>Date</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingList.map(r => <ReportRow key={r.id} r={r} />)}
            </tbody>
          </table>
        )}
      </div>

      {/* Published */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <FileText size={16} color="var(--emerald)" />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Published Reports
          </h3>
          <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(5,150,105,0.15)', color: 'var(--emerald)', fontSize: '12px', fontWeight: '600' }}>
            {publishedList.length}
          </span>
        </div>

        {loadingPublished ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading...</p>
        ) : !publishedList.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No published reports yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th><th>Assessment</th><th>Company</th>
                <th>MCQ</th><th>Overall</th><th>Result</th>
                <th>Integrity</th><th>Published</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {publishedList.map(r => <ReportRow key={r.id} r={r} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
