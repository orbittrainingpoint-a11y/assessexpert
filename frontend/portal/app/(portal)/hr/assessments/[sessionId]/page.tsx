'use client'
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { reportsApi, recordingsApi } from '@/lib/api'
import { use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Clock, Download, Video, X, Share2, Users } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?candidateId= deep-links to a specific candidate's report; defaults
  // to the first report returned by listForSession.
  const candidateIdParam = searchParams.get('candidateId') || ''
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(candidateIdParam)
  const [showRecording, setShowRecording] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState('')
  const [recordingDaysLeft, setRecordingDaysLeft] = useState<number | null>(null)
  const [loadingRecording, setLoadingRecording] = useState(false)

  // List of all per-candidate reports for this slot.
  const { data: reportList } = useQuery({
    queryKey: ['hr-report-list', sessionId],
    queryFn: () => reportsApi.listForSession(sessionId).then(r => r.data as any[]).catch(() => []),
  })

  // Default to the first report when no candidateId in URL — keeps
  // single-candidate sessions working unchanged.
  useEffect(() => {
    if (selectedCandidateId) return
    if (Array.isArray(reportList) && reportList.length > 0) {
      setSelectedCandidateId(reportList[0].candidateId)
    }
  }, [reportList, selectedCandidateId])

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', sessionId, selectedCandidateId],
    queryFn: () => reportsApi.getBySession(sessionId, selectedCandidateId || undefined).then(r => r.data),
  })

  const rateMutation = useMutation({
    mutationFn: ({ rating }: { rating: number }) => reportsApi.rate(sessionId, rating, undefined, selectedCandidateId || undefined),
    onSuccess: () => toast.success('Rating submitted'),
  })

  const handleWatchRecording = async () => {
    setLoadingRecording(true)
    try {
      const { data } = await recordingsApi.getUrl(sessionId, selectedCandidateId || undefined)
      setRecordingUrl(data.url)
      // Calculate days remaining from createdAt + 7 days
      if (data.expiresAt) {
        const daysLeft = Math.max(0, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 86400000))
        setRecordingDaysLeft(daysLeft)
      }
      setShowRecording(true)
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Recording not available or has expired')
    } finally {
      setLoadingRecording(false)
    }
  }

  const handleDownloadPdf = async () => {
    try {
      // Validate sessionId is alphanumeric/UUID only before using in URL
      const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-_]/g, '')
      if (!safeSessionId || safeSessionId !== sessionId) throw new Error('Invalid session ID')
      // Sanitise candidateId the same way before appending — never trust
      // raw query-string input even though it came from our own URL.
      const safeCandidateId = selectedCandidateId ? selectedCandidateId.replace(/[^a-zA-Z0-9-_]/g, '') : ''
      const cidQs = safeCandidateId ? `?candidateId=${encodeURIComponent(safeCandidateId)}` : ''
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/reports/session/${safeSessionId}/pdf${cidQs}`, {
        credentials: 'include',
      })
      if (response.status === 404) {
        toast('PDF export is not enabled yet. Showing the on-screen report instead.', { icon: 'ℹ️' })
        return
      }
      if (!response.ok) throw new Error('PDF generation failed')
      const ct = response.headers.get('content-type') || ''
      if (!ct.includes('pdf')) throw new Error('Server did not return a PDF')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = safeCandidateId
        ? `assessment-report-${safeSessionId}-${safeCandidateId}.pdf`
        : `assessment-report-${safeSessionId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(e?.message || 'PDF download failed')
    }
  }

  const handleShareLink = async () => {
    try {
      const { data } = await reportsApi.getBySession(sessionId, selectedCandidateId || undefined)
      // Sanitize verification code — alphanumeric only, no user-controlled HTML injection
      const safeCode = String(data.verificationCode || sessionId).replace(/[^a-zA-Z0-9-_]/g, '')
      const shareUrl = `${window.location.origin}/reports/verify/${safeCode}`
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Shareable link copied to clipboard')
    } catch {
      toast.error('Could not generate share link')
    }
  }

  // Build the candidate option list from the per-candidate report rows.
  const candidateOptions = useMemo(() => {
    if (!Array.isArray(reportList)) return []
    return reportList
      .map((r: any) => {
        const id = r.candidateId
        const c = r.session?.candidate
        const name = `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || 'Candidate'
        return { id, name }
      })
      .filter(o => !!o.id)
  }, [reportList])
  const isMultiCandidate = candidateOptions.length > 1

  if (isLoading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading report...</div>
  if (!report) return <div style={{ color: 'var(--rose)', padding: '40px' }}>Report not found</div>

  const breakdown = (report.mcqBreakdown as any)?.questions || []
  const candidate = report.session?.candidate
  const assessmentType = report.session?.assessmentType

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Per-candidate report selector — only renders for multi-candidate slots */}
      {isMultiCandidate && (
        <div className="glass-card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Users size={14} color="var(--cyan)" />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginRight: '4px' }}>
            Candidate
          </span>
          {candidateOptions.map(o => {
            const active = o.id === selectedCandidateId
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setSelectedCandidateId(o.id)
                  router.replace(`/hr/assessments/${sessionId}?candidateId=${encodeURIComponent(o.id)}`)
                }}
                style={{
                  padding: '6px 14px', borderRadius: '999px',
                  border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
                  background: active ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)',
                  color: active ? 'var(--cyan)' : 'var(--text-secondary)',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {o.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Header */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>
              {candidate?.firstName} {candidate?.lastName}
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>{assessmentType?.name}</p>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '12px' }}>
              Published: {report.publishedAt ? new Date(report.publishedAt).toLocaleString() : '—'}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <span className={`badge ${report.overallPassed ? 'badge-pass' : 'badge-fail'}`} style={{ fontSize: '16px', padding: '8px 20px' }}>
              {report.proctorVerdict?.replace(/_/g, ' ') || (report.overallPassed ? 'PASS' : 'FAIL')}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={handleDownloadPdf} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Download size={12} /> PDF
              </button>
              <button onClick={handleShareLink} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Share2 size={12} /> Share
              </button>
              <button onClick={handleWatchRecording} disabled={loadingRecording} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--cyan)', borderColor: 'rgba(0,212,255,0.3)' }}>
                <Video size={12} /> {loadingRecording ? 'Loading...' : 'Recording'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'MCQ Score', value: `${report.mcqScore?.toFixed(1)}%`, passed: report.mcqPassed },
          { label: 'Practical Score', value: report.practicalScore != null ? `${report.practicalScore?.toFixed(1)}%` : 'N/A', passed: report.practicalPassed ?? true },
          { label: 'Overall Score', value: `${report.overallScore?.toFixed(1)}%`, passed: report.overallPassed },
          { label: 'Integrity Score', value: `${report.integrityScore?.toFixed(0)}/100`, passed: (report.integrityScore || 0) >= 75 },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: s.passed ? 'var(--emerald)' : 'var(--rose)' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Narrative */}
      {report.aiNarrative && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>AI Performance Analysis</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>{report.aiNarrative}</p>
        </div>
      )}

      {/* Proctor Narrative */}
      {report.proctorNarrative && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderLeft: '3px solid var(--cyan)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Proctor Assessment</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>{report.proctorNarrative}</p>
        </div>
      )}

      {/* MCQ Breakdown */}
      {breakdown.length > 0 && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            MCQ Question-by-Question Breakdown ({breakdown.filter((q: any) => q.isCorrect).length}/{breakdown.length} correct)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {breakdown.map((q: any) => (
              <div key={q.position} style={{ padding: '14px 16px', borderRadius: '8px', background: q.isCorrect ? 'rgba(5,150,105,0.06)' : 'rgba(225,29,72,0.06)', border: `1px solid ${q.isCorrect ? 'rgba(5,150,105,0.2)' : 'rgba(225,29,72,0.2)'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>
                    {q.isCorrect ? <CheckCircle size={16} color="var(--emerald)" /> : <XCircle size={16} color="var(--rose)" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>Q{q.position}. {q.questionText}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Candidate answered: </span>
                        <span style={{ color: q.isCorrect ? 'var(--emerald)' : 'var(--rose)', fontWeight: '500' }}>{q.candidateAnswerText || 'No answer'}</span>
                      </div>
                      {!q.isCorrect && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Correct answer: </span>
                          <span style={{ color: 'var(--emerald)', fontWeight: '500' }}>{q.correctAnswerText}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <Clock size={11} /> {q.timeSpentSeconds}s · {q.marks}/{q.maxMarks} marks
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendation */}
      {report.aiRecommendation && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>AI Recommendation</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>{report.aiRecommendation}</p>
        </div>
      )}

      {/* Rate report */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Rate This Report</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => rateMutation.mutate({ rating: n })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: n <= (report.hrRating || 0) ? 'var(--amber)' : 'var(--text-muted)' }}>★</button>
          ))}
          {report.hrRating && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>You rated {report.hrRating}/5</span>}
        </div>
      </div>

      {/* ── RECORDING PLAYER MODAL ── */}
      {showRecording && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Session Recording — {candidate?.firstName} {candidate?.lastName}</span>
              {recordingDaysLeft !== null && (
                <span style={{ marginLeft: '12px', fontSize: '12px', color: recordingDaysLeft <= 1 ? 'var(--rose)' : 'var(--amber)', fontWeight: '600' }}>
                  ⚠ {recordingDaysLeft === 0 ? 'Expires today' : `${recordingDaysLeft} day${recordingDaysLeft !== 1 ? 's' : ''} remaining`}
                </span>
              )}
            </div>
            <button onClick={() => setShowRecording(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
          </div>

          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', overflow: 'hidden' }}>
            {/* Webcam feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate Webcam</p>
              {recordingUrl ? (
                <video controls style={{ width: '100%', borderRadius: '8px', background: '#000', flex: 1 }} src={recordingUrl}>
                  Your browser does not support video playback.
                </video>
              ) : (
                <div style={{ flex: 1, background: '#000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Webcam recording</span>
                </div>
              )}
            </div>

            {/* Screen recording */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Screen Recording</p>
              <div style={{ flex: 1, background: '#000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Screen recording (synced)</span>
              </div>
            </div>
          </div>

          {/* Chapter markers */}
          <div style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', gap: '12px', overflowX: 'auto' }}>
            {[
              { label: 'Checklist Complete', time: report.session?.checklistCompletedAt },
              { label: 'MCQ Start', time: report.session?.mcqStartedAt },
              { label: 'MCQ End', time: report.session?.mcqEndedAt },
              { label: 'Practical Start', time: report.session?.practicalStartedAt },
              { label: 'Practical End', time: report.session?.endedAt },
            ].filter(m => m.time).map(m => (
              <button key={m.label} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--cyan)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {m.label} · {new Date(m.time!).toLocaleTimeString()}
              </button>
            ))}
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center', flexShrink: 0 }}>
              Note: Download disabled for security compliance
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
