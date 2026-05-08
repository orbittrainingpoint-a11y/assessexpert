'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi, recordingsApi, schedulingApi } from '@/lib/api'
import { FileText, Video, Download, Filter, X } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const RESCHEDULE_REASONS = ['Failed Assessment', 'No-Show', 'Technical Issue', 'Candidate Request', 'Other']

export default function AssessmentsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')
  const [rescheduleReport, setRescheduleReport] = useState<any>(null)
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [rescheduleNotes, setRescheduleNotes] = useState('')

  const { data: reports, isLoading } = useQuery({
    queryKey: ['hr-reports', statusFilter, resultFilter, sortBy],
    queryFn: () => reportsApi.getAll({
      status: statusFilter || undefined,
      passed: resultFilter === 'pass' ? true : resultFilter === 'fail' ? false : undefined,
      limit: 200,
    }).then(r => r.data),
  })

  const rescheduleMutation = useMutation({
    mutationFn: (d: any) => schedulingApi.schedule(d),
    onSuccess: () => {
      toast.success('Rescheduled — new invitation sent to candidate')
      qc.invalidateQueries({ queryKey: ['hr-reports'] })
      setRescheduleReport(null)
      setRescheduleReason('')
      setRescheduleNotes('')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to reschedule'),
  })

  const handleWatchRecording = async (sessionId: string) => {
    try {
      const { data } = await recordingsApi.getUrl(sessionId)
      window.open(data.url, '_blank')
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Recording not available or expired')
    }
  }

  const handleExportCSV = () => {
    const rows = sortedList.map((r: any) => [
      `${r.session?.candidate?.firstName} ${r.session?.candidate?.lastName}`,
      r.session?.assessmentType?.name,
      r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : '',
      r.mcqScore?.toFixed(1),
      r.overallScore?.toFixed(1),
      r.overallPassed ? 'PASS' : 'FAIL',
      r.integrityScore?.toFixed(0),
    ])
    const csv = [
      ['Candidate', 'Assessment', 'Date', 'MCQ %', 'Overall %', 'Result', 'Integrity'].join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'assessments.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const rawList: any[] = reports?.reports || reports || []

  const sortedList = [...rawList].sort((a, b) => {
    if (sortBy === 'date_desc') return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
    if (sortBy === 'date_asc') return new Date(a.publishedAt || 0).getTime() - new Date(b.publishedAt || 0).getTime()
    if (sortBy === 'score_desc') return (b.overallScore || 0) - (a.overallScore || 0)
    if (sortBy === 'score_asc') return (a.overallScore || 0) - (b.overallScore || 0)
    return 0
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Completed Assessments</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Published reports only — {sortedList.length} total
          </p>
        </div>
        <button className="btn-ghost" onClick={handleExportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Filter:</span>
        </div>
        <select className="form-input" style={{ width: '160px' }} value={resultFilter} onChange={e => setResultFilter(e.target.value)}>
          <option value="">All Results</option>
          <option value="pass">Pass Only</option>
          <option value="fail">Fail Only</option>
        </select>
        <select className="form-input" style={{ width: '180px' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date_desc">Newest First</option>
          <option value="date_asc">Oldest First</option>
          <option value="score_desc">Highest Score</option>
          <option value="score_asc">Lowest Score</option>
        </select>
        {(resultFilter || statusFilter) && (
          <button className="btn-ghost" onClick={() => { setResultFilter(''); setStatusFilter('') }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Candidate</th><th>Assessment</th><th>Date</th>
              <th>MCQ</th><th>Overall</th><th>Result</th>
              <th>Integrity</th><th>Recording</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !sortedList.length ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No published reports yet.</td></tr>
            ) : sortedList.map((r: any) => {
              const integrityColor = (r.integrityScore || 0) >= 90 ? 'var(--emerald)' : (r.integrityScore || 0) >= 75 ? 'var(--amber)' : 'var(--rose)'
              const recordingExpired = r.session?.recordingPurged || !r.session?.recordingExpiresAt
              return (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                    {r.session?.candidate?.firstName} {r.session?.candidate?.lastName}
                  </td>
                  <td style={{ fontSize: '13px' }}>{r.session?.assessmentType?.name}</td>
                  <td style={{ fontSize: '12px' }}>{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : '—'}</td>
                  <td>{r.mcqScore?.toFixed(1)}%</td>
                  <td style={{ fontWeight: '600' }}>{r.overallScore?.toFixed(1)}%</td>
                  <td><span className={`badge ${r.overallPassed ? 'badge-pass' : 'badge-fail'}`}>{r.overallPassed ? 'PASS' : 'FAIL'}</span></td>
                  <td style={{ color: integrityColor, fontWeight: '600' }}>{r.integrityScore?.toFixed(0)}/100</td>
                  <td>
                    {recordingExpired ? (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Expired</span>
                    ) : (
                      <button onClick={() => handleWatchRecording(r.sessionId)} className="btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Video size={11} /> Watch
                      </button>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <Link href={`/hr/assessments/${r.sessionId}`} className="btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                        <FileText size={11} /> Report
                      </Link>
                      {!r.overallPassed && (
                        <button className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--amber)', borderColor: 'rgba(215,119,6,0.3)' }}
                          onClick={() => setRescheduleReport(r)}>
                          Reschedule
                        </button>
                      )}
                      {r.session?.status === 'NO_SHOW' && (
                        <button className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--amber)', borderColor: 'rgba(215,119,6,0.3)' }}
                          onClick={() => setRescheduleReport(r)}>
                          Reschedule
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* RESCHEDULE MODAL */}
      {rescheduleReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Reschedule Assessment</h2>
              <button onClick={() => setRescheduleReport(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                {rescheduleReport.session?.candidate?.firstName} {rescheduleReport.session?.candidate?.lastName}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {rescheduleReport.session?.assessmentType?.name} · Previous result: {rescheduleReport.overallScore?.toFixed(1)}% FAIL
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Reason for Rescheduling *</label>
                <select className="form-input" value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)}>
                  <option value="">Select reason...</option>
                  {RESCHEDULE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Notes (optional)</label>
                <textarea className="form-input" rows={2} value={rescheduleNotes}
                  onChange={e => setRescheduleNotes(e.target.value)}
                  placeholder="Any additional context..." style={{ resize: 'vertical' }} />
              </div>
              <div style={{ padding: '10px 14px', background: 'rgba(0,212,255,0.06)', borderRadius: '8px', fontSize: '12px', color: 'var(--cyan)' }}>
                A new session will be created and a fresh invitation email will be sent to the candidate.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn-ghost" onClick={() => setRescheduleReport(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }}
                disabled={!rescheduleReason || rescheduleMutation.isPending}
                onClick={() => rescheduleMutation.mutate({
                  candidateId: rescheduleReport.session?.candidateId,
                  assessmentTypeId: rescheduleReport.session?.assessmentTypeId,
                  reason: rescheduleReason,
                  notes: rescheduleNotes,
                  isReschedule: true,
                  previousSessionId: rescheduleReport.sessionId,
                })}>
                {rescheduleMutation.isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
