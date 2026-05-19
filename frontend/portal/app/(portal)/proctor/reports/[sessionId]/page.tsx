'use client'
import { useEffect, useState, useMemo, Suspense } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { reportsApi, sessionsApi, transcriptApi } from '@/lib/api'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, FileText, Download, Play, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

// Values match the Prisma PracticalQuality enum. Labels are display-only.
const PRACTICAL_VERDICTS = [
  { value: 'EXCELLENT',     label: 'Excellent' },
  { value: 'GOOD',          label: 'Good' },
  { value: 'SATISFACTORY',  label: 'Satisfactory' },
  { value: 'POOR',          label: 'Below Standard' },
  { value: 'DID_NOT_SUBMIT', label: 'Did Not Submit' },
] as const
// Values match the Prisma ProctorVerdict enum.
const OVERALL_VERDICTS = [
  { value: 'PASS',         label: 'Pass — No concerns' },
  { value: 'CONDITIONAL',  label: 'Conditional — Minor observations noted' },
  { value: 'FLAGGED',      label: 'Flagged — Integrity concerns; recommend caution' },
  { value: 'FAIL',         label: 'Fail — Did not meet bar' },
  { value: 'DISQUALIFIED', label: 'Disqualified — Clear violation; do not hire' },
] as const

function ReportReviewContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = params.sessionId as string
  // ?candidateId= deep-links to a specific candidate's report in a
  // multi-candidate slot. Defaults to the first one returned by listForSession.
  const candidateIdParam = searchParams.get('candidateId') || ''
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(candidateIdParam)

  const [narrative, setNarrative] = useState('')
  const [practicalVerdict, setPracticalVerdict] = useState('')
  const [overallVerdict, setOverallVerdict] = useState('')
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  // Active candidate for the transcript card filter (multi-candidate slots).
  // 'all' shows the conversation chronologically across everyone in the slot.
  const [transcriptCandidateId, setTranscriptCandidateId] = useState<string>('all')

  // List of all per-candidate reports for this slot. Used to render the
  // candidate chip selector and to default selectedCandidateId.
  const { data: reportList } = useQuery({
    queryKey: ['proctor-report-list', sessionId],
    queryFn: () => reportsApi.listForSession(sessionId).then(r => r.data as any[]).catch(() => []),
    enabled: !!sessionId,
  })

  // Pick the first report as default when no candidateId in URL — keeps
  // single-candidate sessions working unchanged.
  useEffect(() => {
    if (selectedCandidateId) return
    if (Array.isArray(reportList) && reportList.length > 0) {
      setSelectedCandidateId(reportList[0].candidateId)
    }
  }, [reportList, selectedCandidateId])

  const { data: report, isLoading } = useQuery({
    queryKey: ['proctor-report', sessionId, selectedCandidateId],
    queryFn: () => reportsApi.getBySession(sessionId, selectedCandidateId || undefined).then(r => r.data).catch(() => null),
    enabled: !!sessionId,
  })

  const { data: session } = useQuery({
    queryKey: ['session-for-report', sessionId],
    queryFn: () => sessionsApi.getOne(sessionId).then(r => r.data),
    enabled: !!sessionId,
  })

  const { data: transcriptData } = useQuery({
    queryKey: ['verification-transcript', sessionId],
    queryFn: () => transcriptApi.get(sessionId).then(r => r.data),
    enabled: !!sessionId,
  })

  // Reset the proctor form when switching candidates so we don't carry
  // narrative/verdict from one candidate over to another.
  useEffect(() => {
    setNarrative('')
    setPracticalVerdict('')
    setOverallVerdict('')
    setCheck1(false)
    setCheck2(false)
  }, [selectedCandidateId])

  const publishMutation = useMutation({
    mutationFn: async () => {
      // Match the backend's expected shape (Prisma column names):
      // proctorNarrative, proctorVerdict (ProctorVerdict), practicalQuality (PracticalQuality).
      const cId = selectedCandidateId || undefined
      await reportsApi.updateProctorFields(sessionId, {
        proctorNarrative: narrative,
        proctorVerdict: overallVerdict,
        practicalQuality: practicalVerdict,
        candidateId: cId,
      })
      await reportsApi.publish(sessionId, cId)
    },
    onSuccess: () => {
      toast.success('Report published to HR Dashboard')
      router.push('/proctor/reports')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to publish'),
  })

  const canPublish = narrative.trim().length >= 50 && practicalVerdict && overallVerdict && check1 && check2

  if (isLoading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading report...</div>

  // Build the candidate list from session.sessionCandidates (multi) or
  // the session's primary candidate (single). Used to render the chip
  // selector and to look up the active candidate's display name.
  const candidateOptions = useMemo(() => {
    const list: { id: string; name: string }[] = []
    const sc = session?.sessionCandidates
    if (Array.isArray(sc) && sc.length) {
      sc.forEach((row: any) => {
        if (row?.candidate?.id) {
          list.push({
            id: row.candidate.id,
            name: `${row.candidate.firstName || ''} ${row.candidate.lastName || ''}`.trim() || 'Candidate',
          })
        }
      })
    }
    if (!list.length && session?.candidate?.id) {
      list.push({
        id: session.candidate.id,
        name: `${session.candidate.firstName || ''} ${session.candidate.lastName || ''}`.trim() || 'Candidate',
      })
    }
    return list
  }, [session])
  const isMultiCandidate = candidateOptions.length > 1
  const activeCandidate = candidateOptions.find(c => c.id === selectedCandidateId) || candidateOptions[0]

  // No report yet — show generate CTA for the active candidate.
  if (!report && session) return (
    <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
      {isMultiCandidate && (
        <ChipRow
          options={candidateOptions}
          activeId={selectedCandidateId}
          onSelect={id => {
            setSelectedCandidateId(id)
            router.replace(`/proctor/reports/${sessionId}?candidateId=${encodeURIComponent(id)}`)
          }}
        />
      )}
      <div className="glass-card" style={{ padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <h2 style={{ color: 'var(--text-primary)', margin: '0 0 12px' }}>Report Not Generated Yet</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', marginBottom: '24px' }}>
          The AI report for {activeCandidate?.name || `${session?.candidate?.firstName} ${session?.candidate?.lastName}`} has not been generated yet.
          Click below to generate it now.
        </p>
        <button className="btn-primary" style={{ padding: '12px 32px', fontSize: '15px' }}
          onClick={() => reportsApi.generate(sessionId, selectedCandidateId ? { candidateId: selectedCandidateId } : undefined)
            .then(() => { toast.success('Report generation started'); window.location.reload() })
            .catch((e: any) => toast.error(e.response?.data?.message || 'Failed'))}
        >
          🤖 Generate AI Report
        </button>
        <div style={{ marginTop: '16px' }}>
          <Link href="/proctor/reports" style={{ color: 'var(--cyan)', fontSize: '13px', textDecoration: 'none' }}>← Back to Reports</Link>
        </div>
      </div>
    </div>
  )

  if (!report) return <div style={{ color: 'var(--rose)', padding: '40px' }}>Session not found.</div>

  const candidate = activeCandidate
    ? { firstName: activeCandidate.name.split(' ')[0], lastName: activeCandidate.name.split(' ').slice(1).join(' ') }
    : session?.candidate
  const mcqScore = session?.mcqScore ?? report?.mcqScore ?? 0
  const mcqTotal = session?.assessmentType?.mcqCount ?? 25
  const practicalScore = report?.practicalScore ?? 0
  const integrityScore = report?.integrityScore ?? 100
  const integrityColor = integrityScore >= 90 ? 'var(--emerald)' : integrityScore >= 75 ? 'var(--amber)' : integrityScore >= 50 ? 'var(--orange, #f97316)' : 'var(--rose)'

  const flags: any[] = report?.flags || []
  const recordingUrl: string = report?.recordingUrl || session?.recordingUrl || ''

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Report Review — {candidate?.firstName} {candidate?.lastName}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            {session?.assessmentType?.name} · {session?.organization?.name}
          </p>
        </div>
        <Link href="/proctor/reports" style={{ fontSize: '13px', color: 'var(--cyan)', textDecoration: 'none' }}>← Back to Reports</Link>
      </div>

      {/* Per-candidate report selector — only renders for multi-candidate slots */}
      {isMultiCandidate && (
        <ChipRow
          options={candidateOptions}
          activeId={selectedCandidateId}
          onSelect={id => {
            setSelectedCandidateId(id)
            router.replace(`/proctor/reports/${sessionId}?candidateId=${encodeURIComponent(id)}`)
          }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '20px' }}>

        {/* ── LEFT: Review Tools ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Recording Player */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Session Recording</h3>
            {recordingUrl ? (
              <div>
                <video controls style={{ width: '100%', borderRadius: '8px', background: '#000', marginBottom: '10px' }} src={recordingUrl} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[
                    { label: 'MCQ Start', time: session?.mcqStartedAt },
                    { label: 'MCQ End', time: session?.mcqEndedAt },
                    { label: 'Practical Start', time: session?.practicalStartedAt },
                    { label: 'Practical End', time: session?.endedAt },
                  ].filter(m => m.time).map(m => (
                    <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 8px', background: 'var(--bg-elevated)', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                      <span style={{ color: 'var(--cyan)' }}>{new Date(m.time!).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '8px', textAlign: 'center' }}>
                <Play size={24} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Recording not available</p>
              </div>
            )}
          </div>

          {/* Practical Submission */}
          {session?.practicalSubmissionUrl && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Practical Submission</h3>
              <a href={session.practicalSubmissionUrl} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: '8px', textDecoration: 'none', color: 'var(--cyan)', fontSize: '13px' }}>
                <Download size={14} /> Download Submitted File
              </a>
            </div>
          )}

          {/* AI Evaluation Summary */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>AI Evaluation Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'MCQ Score', value: `${mcqScore}/${mcqTotal} (${Math.round((mcqScore / mcqTotal) * 100)}%)`, color: mcqScore / mcqTotal >= 0.6 ? 'var(--emerald)' : 'var(--rose)' },
                { label: 'Practical Score', value: `${practicalScore}/100`, color: practicalScore >= 60 ? 'var(--emerald)' : 'var(--rose)' },
                { label: 'Integrity Score', value: `${integrityScore}/100`, color: integrityColor },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>

            {flags.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirmed Flags ({flags.length})</p>
                {flags.map((f: any, i: number) => (
                  <div key={i} style={{ padding: '6px 10px', background: 'rgba(225,29,72,0.08)', borderRadius: '6px', fontSize: '12px', color: 'var(--rose)', marginBottom: '4px' }}>
                    {f.eventType?.replace(/_/g, ' ')} · {new Date(f.timestamp).toLocaleTimeString()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Proctor Assessment ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* AI Report Preview */}
          {report?.aiNarrative && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                <FileText size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--cyan)' }} />
                AI-Generated Report
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>{report.aiNarrative}</p>
            </div>
          )}

          {/* Verification Conversation Transcript — read-only, captured live
              by both browsers during pre-exam verification. Each line is
              tagged with which candidate the proctor was verifying when it
              was spoken, so multi-candidate slots get a per-candidate view. */}
          <VerificationTranscriptCard
            lines={(transcriptData?.lines as any[]) || []}
            sessionCandidates={session?.sessionCandidates || []}
            primaryCandidate={candidate}
            activeCandidateId={transcriptCandidateId}
            onChangeActive={setTranscriptCandidateId}
          />

          {/* Proctor Assessment Form */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Proctor Assessment</h3>

            {/* Practical Quality Verdict */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Practical Quality Verdict *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                {PRACTICAL_VERDICTS.map(v => (
                  <button key={v.value} onClick={() => setPracticalVerdict(v.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${practicalVerdict === v.value ? 'var(--cyan)' : 'var(--border)'}`, background: practicalVerdict === v.value ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: practicalVerdict === v.value ? 'var(--cyan)' : 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', fontWeight: practicalVerdict === v.value ? '600' : '400' }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Overall Proctor Verdict */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Overall Proctor Verdict *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {OVERALL_VERDICTS.map(v => (
                  <button key={v.value} onClick={() => setOverallVerdict(v.value)}
                    style={{ padding: '10px 14px', borderRadius: '6px', border: `1px solid ${overallVerdict === v.value ? 'var(--cyan)' : 'var(--border)'}`, background: overallVerdict === v.value ? 'rgba(0,212,255,0.08)' : 'var(--bg-elevated)', color: overallVerdict === v.value ? 'var(--cyan)' : 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontWeight: overallVerdict === v.value ? '600' : '400' }}>
                    {overallVerdict === v.value ? '● ' : '○ '}{v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Proctor Narrative */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Proctor Narrative * <span style={{ color: narrative.length >= 50 ? 'var(--emerald)' : 'var(--rose)', fontWeight: '600' }}>({narrative.length}/50 min)</span>
              </label>
              <textarea
                className="form-input"
                rows={5}
                value={narrative}
                onChange={e => setNarrative(e.target.value)}
                placeholder="Write your professional assessment of the candidate's performance, behaviour, and any observations from the session..."
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Confirmation Checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
              {[
                { checked: check1, set: setCheck1, label: 'I have reviewed the screen recording and all submitted materials.' },
                { checked: check2, set: setCheck2, label: 'I confirm this report accurately reflects the candidate\'s performance.' },
              ].map((item, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)}
                    style={{ marginTop: '2px', width: '15px', height: '15px', accentColor: 'var(--cyan)', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: item.checked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{item.label}</span>
                </label>
              ))}
            </div>

            {/* Publish Button */}
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px', opacity: canPublish ? 1 : 0.4, cursor: canPublish ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={!canPublish || publishMutation.isPending}
              onClick={() => canPublish && publishMutation.mutate()}
            >
              <CheckCircle size={16} />
              {publishMutation.isPending ? 'Publishing...' : '📤 Publish Report to HR Dashboard'}
            </button>

            {!canPublish && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Complete all fields above to unlock publish
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Top-of-page chip selector for switching between candidates' reports
// in a multi-candidate slot.
function ChipRow({
  options,
  activeId,
  onSelect,
}: {
  options: { id: string; name: string }[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="glass-card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <Users size={14} color="var(--cyan)" />
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginRight: '4px' }}>
        Candidate
      </span>
      {options.map(o => {
        const active = o.id === activeId
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
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
  )
}

interface TranscriptLine {
  candidateId?: string | null
  speaker: 'PROCTOR' | 'CANDIDATE'
  text: string
  timestamp?: string
}

interface CandidateOption {
  id: string
  name: string
}

function VerificationTranscriptCard({
  lines,
  sessionCandidates,
  primaryCandidate,
  activeCandidateId,
  onChangeActive,
}: {
  lines: TranscriptLine[]
  sessionCandidates: any[]
  primaryCandidate: any
  activeCandidateId: string
  onChangeActive: (id: string) => void
}) {
  // Build a normalised candidate list: prefer sessionCandidates (multi-slot)
  // and fall back to the session's primary candidate (single-candidate).
  const candidates: CandidateOption[] = useMemo(() => {
    const list: CandidateOption[] = []
    if (Array.isArray(sessionCandidates) && sessionCandidates.length) {
      sessionCandidates.forEach((sc: any) => {
        if (sc?.candidate?.id) {
          list.push({
            id: sc.candidate.id,
            name: `${sc.candidate.firstName || ''} ${sc.candidate.lastName || ''}`.trim() || 'Candidate',
          })
        }
      })
    }
    if (!list.length && primaryCandidate?.id) {
      list.push({
        id: primaryCandidate.id,
        name: `${primaryCandidate.firstName || ''} ${primaryCandidate.lastName || ''}`.trim() || 'Candidate',
      })
    }
    return list
  }, [sessionCandidates, primaryCandidate])

  const lineCountByCandidate: Record<string, number> = useMemo(() => {
    const acc: Record<string, number> = {}
    lines.forEach(l => {
      const key = l.candidateId || '__untagged__'
      acc[key] = (acc[key] || 0) + 1
    })
    return acc
  }, [lines])

  const filteredLines = useMemo(() => {
    if (activeCandidateId === 'all') return lines
    return lines.filter(l => (l.candidateId || '') === activeCandidateId)
  }, [lines, activeCandidateId])

  const isMulti = candidates.length > 1
  const totalLines = lines.length

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
          <FileText size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--cyan)' }} />
          Verification Conversation
          {totalLines > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              ({totalLines} line{totalLines === 1 ? '' : 's'})
            </span>
          )}
        </h3>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Read-only · captured live
        </span>
      </div>

      {/* Per-candidate filter chips — only shown when there's more than one
          candidate in the slot. Single-candidate sessions skip the chip row. */}
      {isMulti && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          <FilterChip
            label="All"
            count={totalLines}
            active={activeCandidateId === 'all'}
            onClick={() => onChangeActive('all')}
            icon={<Users size={11} />}
          />
          {candidates.map(c => (
            <FilterChip
              key={c.id}
              label={c.name}
              count={lineCountByCandidate[c.id] || 0}
              active={activeCandidateId === c.id}
              onClick={() => onChangeActive(c.id)}
            />
          ))}
        </div>
      )}

      {filteredLines.length === 0 ? (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {totalLines === 0
            ? 'No transcript captured. Speech-to-text requires Chrome/Edge during the verification phase.'
            : 'No lines for this candidate.'}
        </p>
      ) : (
        <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredLines.map((l, i) => {
            const isProctor = l.speaker === 'PROCTOR'
            const candidateName = l.candidateId
              ? (candidates.find(c => c.id === l.candidateId)?.name || 'Candidate')
              : ''
            return (
              <div key={i} style={{
                padding: '8px 10px', borderRadius: '6px',
                background: isProctor ? 'rgba(0,212,255,0.06)' : 'rgba(5,150,105,0.06)',
                borderLeft: `3px solid ${isProctor ? 'var(--cyan)' : 'var(--emerald)'}`,
                userSelect: 'text', cursor: 'default',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '10px', marginBottom: '4px' }}>
                  <span style={{ color: isProctor ? 'var(--cyan)' : 'var(--emerald)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {l.speaker}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                    {isMulti && candidateName && activeCandidateId === 'all' && (
                      <span style={{ padding: '1px 6px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '9px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {candidateName}
                      </span>
                    )}
                    <span>{l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : ''}</span>
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  {l.text}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Per-candidate summary — quick "how much did each side talk" view. */}
      {isMulti && totalLines > 0 && (
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
          {candidates.map(c => {
            const cLines = lines.filter(l => l.candidateId === c.id)
            const proctorN = cLines.filter(l => l.speaker === 'PROCTOR').length
            const candidateN = cLines.filter(l => l.speaker === 'CANDIDATE').length
            return (
              <div key={c.id} style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span><span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{proctorN}</span> proctor</span>
                  <span><span style={{ color: 'var(--emerald)', fontWeight: 600 }}>{candidateN}</span> candidate</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 11px', borderRadius: '999px',
        border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
        background: active ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)',
        color: active ? 'var(--cyan)' : 'var(--text-secondary)',
        fontSize: '11px', fontWeight: 600, cursor: 'pointer',
      }}
    >
      {icon}
      <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ opacity: 0.7, fontWeight: 500 }}>{count}</span>
    </button>
  )
}

export default function ProctorReportReviewPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>}>
      <ReportReviewContent />
    </Suspense>
  )
}
