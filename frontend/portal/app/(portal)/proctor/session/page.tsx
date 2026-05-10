'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi, proctoringApi, reportsApi } from '@/lib/api'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Video, VideoOff } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useSessionWebSocket } from '@/lib/useWebSocket'
import { useWebRTC } from '@/lib/useWebRTC'
import { useMediaPipe } from '@/lib/useMediaPipe'
import ChecklistPanel from '@/components/proctor/ChecklistPanel'
import MonitorGrid from '@/components/proctor/MonitorGrid'
import FlagQueue from '@/components/proctor/FlagQueue'
import PracticalPanel, { PostSessionPanel } from '@/components/proctor/PracticalPanel'
import AIMonitoringPanel from '@/components/proctor/AIMonitoringPanel'
import CaptureGallery from '@/components/proctor/CaptureGallery'
import VerificationLayout from '@/components/proctor/VerificationLayout'
import PostVerificationLayout from '@/components/proctor/PostVerificationLayout'

type SessionPhase = 'checklist' | 'mcq' | 'practical' | 'complete'

function SessionContent() {
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('id') || ''

  const [phase, setPhase] = useState<SessionPhase>('checklist')
  const [isPaused, setIsPaused] = useState(false)
  const [resolvedFlagIds, setResolvedFlagIds] = useState<string[]>([])
  const [activeCandidateId, setActiveCandidateId] = useState<string | undefined>()
  const [verifiedCandidates, setVerifiedCandidates] = useState<Set<string>>(new Set())
  const [mcqPushed, setMcqPushed] = useState(false)

  const socketRef = useRef<any>(null)
  const { emit: wsEmit, socket: wsSocket } = useSessionWebSocket({
    sessionId,
    role: 'PROCTOR',
    enabled: !!sessionId,
    onEvent: (event, data) => {
      if (event === 'candidate.joined' || event === 'ai.flag') {
        qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] })
        qc.invalidateQueries({ queryKey: ['session-events', sessionId] })
      }
      if (event === 'session.submitted') {
        qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] })
      }
    },
  })
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const proctorStreamRef = useRef<MediaStream | null>(null)
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null)

  const { alerts, behaviorScore, isMonitoring, dismissAlert } = useMediaPipe({
    sessionId,
    socket: wsSocket,
    enabled: !!sessionId && (phase === 'mcq' || phase === 'practical'),
    onAlert: (alert) => {
      if (alert.severity === 'critical') {
        toast.error(alert.message, { duration: 5000 })
      }
    },
  })

  const assignProctorStream = useCallback((el: HTMLVideoElement | null) => {
    if (!el || !proctorStreamRef.current) return
    if (el.srcObject !== proctorStreamRef.current) el.srcObject = proctorStreamRef.current
    el.play().catch(() => {})
  }, [])

  const startProctorCamera = useCallback(async () => {
    try {
      if (proctorStreamRef.current) proctorStreamRef.current.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      proctorStreamRef.current = stream
      setCameraActive(true)
      setCameraError(false)
      assignProctorStream(proctorVideoRef.current)
    } catch {
      setCameraError(true)
    }
  }, [assignProctorStream])

  useEffect(() => {
    startProctorCamera()
    return () => {
      if (proctorStreamRef.current) proctorStreamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const { data: session, isLoading } = useQuery({
    queryKey: ['proctor-session', sessionId],
    queryFn: () => sessionsApi.getOne(sessionId).then(r => r.data),
    enabled: !!sessionId,
    refetchInterval: 10000,
  })

  const { data: sessionCandidates } = useQuery({
    queryKey: ['session-candidates', sessionId],
    queryFn: () => fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions/${sessionId}/candidates`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(r => r.json()),
    enabled: !!sessionId && !!session?.isMultiCandidate,
    refetchInterval: 5000,
  })

  const { data: events } = useQuery({
    queryKey: ['session-events', sessionId],
    queryFn: () => proctoringApi.getEvents(sessionId).then(r => r.data),
    enabled: !!sessionId,
    refetchInterval: 5000,
  })

  const { remoteStreams } = useWebRTC({
    sessionId,
    role: 'PROCTOR',
    localStream: cameraActive ? proctorStreamRef.current : null,
    socket: wsSocket,
    enabled: !!sessionId && cameraActive && !!session,
    activeCandidateId,
  })

  const handleCandidateSelect = useCallback((candidateId: string) => {
    if (activeCandidateId === candidateId) {
      setActiveCandidateId(undefined)
      if (wsSocket?.connected) {
        wsSocket.emit('proctor.leaveVerification', { sessionId, candidateId })
      }
    } else {
      setActiveCandidateId(candidateId)
      if (wsSocket?.connected) {
        wsSocket.emit('proctor.enterVerification', { sessionId, candidateId })
      }
    }
  }, [activeCandidateId, sessionId, wsSocket])

  const handleAllVerified = useCallback(() => {
    if (wsSocket?.connected) {
      wsSocket.emit('proctor.allVerified', { sessionId })
    }
    setMcqPushed(true)
    setPhase('mcq')
  }, [sessionId, wsSocket])

  const handlePushMCQ = useCallback(() => {
    if (wsSocket?.connected) {
      wsSocket.emit('exam.pushMCQ', { sessionId })
    }
    setMcqPushed(true)
    toast.success('MCQ pushed to all candidates')
  }, [sessionId, wsSocket])

  const handlePushPractical = useCallback(() => {
    if (wsSocket?.connected) {
      wsSocket.emit('exam.pushPractical', { sessionId })
    }
    toast.success('Practical pushed to all candidates')
  }, [sessionId, wsSocket])

  const handleDisqualify = useCallback((candidateId: string) => {
    const reason = prompt('Reason for disqualification?')
    if (reason && wsSocket?.connected) {
      wsSocket.emit('candidate.disqualified', { sessionId, candidateId, reason })
      toast.success('Candidate disqualified')
    }
  }, [sessionId, wsSocket])

  useEffect(() => {
    if (!session) return
    const s = session.status
    if (s === 'MCQ_IN_PROGRESS') setPhase('mcq')
    else if (['MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL'].includes(s)) setPhase('mcq')
    else if (s === 'PRACTICAL_IN_PROGRESS') setPhase('practical')
    else if (['SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED'].includes(s)) setPhase('complete')
    else setPhase('checklist')
  }, [session?.status])

  const pauseMutation = useMutation({
    mutationFn: () => sessionsApi.pause(sessionId),
    onSuccess: () => { setIsPaused(true); qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const resumeMutation = useMutation({
    mutationFn: () => sessionsApi.resume(sessionId),
    onSuccess: () => { setIsPaused(false); qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const terminateMutation = useMutation({
    mutationFn: (reason: string) => sessionsApi.terminate(sessionId, reason),
    onSuccess: () => { toast.success('Session terminated'); qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  if (!sessionId) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>No session selected.</p>
      <Link href="/proctor/today" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 24px' }}>View Today's Sessions →</Link>
    </div>
  )

  if (isLoading) return <div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading session...</div>
  if (!session) return <div style={{ color: 'var(--rose)', padding: '40px' }}>Session not found.</div>

  const candidate = session.candidate
  const isMultiCandidate = session.isMultiCandidate
  const candidateStream: MediaStream | null = remoteStreams.size > 0 ? (Array.from(remoteStreams.values())[0] as MediaStream) : null
  
  const candidates = isMultiCandidate && sessionCandidates
    ? sessionCandidates.map((sc: any) => ({
        id: sc.candidateId,
        name: `${sc.candidate.firstName} ${sc.candidate.lastName}`,
        stream: remoteStreams.get(sc.socketId) || null,
        socketId: sc.socketId,
        mcqSubmitted: sc.status === 'MCQ_SUBMITTED',
      }))
    : [{
        id: candidate?.id || sessionId,
        name: `${candidate?.firstName} ${candidate?.lastName}`,
        stream: candidateStream,
        socketId: undefined,
        mcqSubmitted: session.status === 'MCQ_SUBMITTED',
      }]

  const allVerified = isMultiCandidate && sessionCandidates
    ? sessionCandidates.every((sc: any) => sc.status !== 'PENDING' && sc.status !== 'JOINED' && sc.status !== 'VERIFYING')
    : verifiedCandidates.size > 0

  const allMcqSubmitted = isMultiCandidate && sessionCandidates
    ? sessionCandidates.every((sc: any) => sc.status === 'MCQ_SUBMITTED' || sc.status === 'PRACTICAL_IN_PROGRESS' || sc.status === 'PRACTICAL_SUBMITTED' || sc.status === 'COMPLETED')
    : session.status === 'MCQ_SUBMITTED'
    
  const allEvents: any[] = Array.isArray(events) ? events : []
  const activeFlags = allEvents.filter(
    e => (e.severity === 'CRITICAL' || e.severity === 'WARNING') && !resolvedFlagIds.includes(e.id)
  )

  const candidateTiles = [{
    id: candidate?.id || sessionId,
    firstName: candidate?.firstName || 'Candidate',
    lastName: candidate?.lastName || '',
    questionProgress: session.currentQuestionIndex || 0,
    totalQuestions: session.assessmentType?.mcqCount || 25,
    faceStatus: 'present' as const,
    screenStatus: 'active' as const,
    submittedPractical: session.status === 'SUBMITTED',
    stream: candidateStream,
  }]

  const mcqResults = [{
    candidateId: candidate?.id || '',
    candidateName: `${candidate?.firstName} ${candidate?.lastName}`,
    score: session.mcqScore || 0,
    total: session.assessmentType?.mcqCount || 25,
    passed: (session.mcqScore || 0) >= Math.floor((session.assessmentType?.mcqCount || 25) * 0.6),
  }]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Live Session — {candidate?.firstName} {candidate?.lastName}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            {session.assessmentType?.name} · Phase: <strong style={{ color: 'var(--cyan)', textTransform: 'capitalize' }}>{phase}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`badge ${['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'].includes(session.status) ? 'badge-live' : session.status === 'REPORT_PUBLISHED' ? 'badge-pass' : 'badge-pending'}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
            {session.status.replace(/_/g, ' ')}
          </span>
          {['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS', 'WAITING_ROOM', 'CHECKLIST'].includes(session.status) && (
            <button className="btn-ghost" onClick={() => { const r = prompt('Reason for termination?'); if (r) terminateMutation.mutate(r) }}
              style={{ fontSize: '12px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)', padding: '6px 12px' }}>
              <AlertTriangle size={13} style={{ display: 'inline', marginRight: '4px' }} />Terminate
            </button>
          )}
        </div>
      </div>

      {!isMultiCandidate && (
        <div className="glass-card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ position: 'relative', width: '180px', flexShrink: 0 }}>
            <video
              ref={el => { proctorVideoRef.current = el; assignProctorStream(el) }}
              autoPlay muted playsInline
              style={{ width: '100%', borderRadius: '6px', background: '#000', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
            />
            {!cameraActive && (
              <div style={{ position: 'absolute', inset: 0, background: '#000', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }}>
                {cameraError ? <VideoOff size={18} color="var(--rose)" /> : <Video size={18} color="var(--text-muted)" />}
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cameraError ? 'Denied' : 'Starting...'}</span>
              </div>
            )}
            <div style={{ position: 'absolute', bottom: '4px', left: '6px', background: 'rgba(0,0,0,0.6)', padding: '2px 5px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: cameraActive ? 'var(--emerald)' : 'var(--rose)' }} />
              <span style={{ fontSize: '9px', color: '#fff' }}>You</span>
            </div>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Your Camera</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: cameraActive ? 'var(--emerald)' : cameraError ? 'var(--rose)' : 'var(--text-muted)' }}>
              {cameraActive ? 'Active — candidates can see you' : cameraError ? 'Camera access denied' : 'Starting...'}
            </p>
            {cameraError && <button className="btn-ghost" onClick={startProctorCamera} style={{ marginTop: '6px', padding: '4px 10px', fontSize: '11px' }}>Retry</button>}
          </div>
        </div>
      )}

      {phase === 'checklist' && (
        isMultiCandidate ? (
          <VerificationLayout
            sessionId={sessionId}
            candidates={candidates}
            proctorStream={proctorStreamRef.current}
            onCandidateSelect={handleCandidateSelect}
            onAllVerifiedClick={handleAllVerified}
            allVerified={allVerified}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            <ChecklistPanel
              sessionId={sessionId}
              candidateVideoRef={proctorVideoRef as React.RefObject<HTMLVideoElement>}
              onAllDone={() => {
                sessionsApi.begin(sessionId)
                  .then(() => { setPhase('mcq'); qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] }) })
                  .catch((e: any) => toast.error(e.response?.data?.message || 'Failed to begin exam'))
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '16px' }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate</p>
                {[
                  ['Name', `${candidate?.firstName} ${candidate?.lastName}`],
                  ['Email', candidate?.email],
                  ['Assessment', session.assessmentType?.name],
                  ['Scheduled', new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })],
                ].map(([l, v]) => (
                  <div key={l} style={{ marginBottom: '8px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{l}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '13px', color: 'var(--text-primary)' }}>{v}</p>
                  </div>
                ))}
              </div>
              <AIMonitoringPanel alerts={alerts} behaviorScore={behaviorScore} isMonitoring={isMonitoring} onDismissAlert={dismissAlert} />
              <CaptureGallery sessionId={sessionId} enabled={phase === 'checklist' || phase === 'mcq' || phase === 'practical'} />
              <FlagQueue flags={activeFlags} onFlagActioned={id => setResolvedFlagIds(p => [...p, id])} />
            </div>
          </div>
        )
      )}

      {phase === 'mcq' && !['MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL'].includes(session.status) && (
        isMultiCandidate ? (
          <PostVerificationLayout
            sessionId={sessionId}
            candidates={candidates.map((c: any) => ({ ...c, screenStream: c.stream, cameraStream: c.stream }))}
            proctorStream={proctorStreamRef.current}
            onPushMCQ={handlePushMCQ}
            onPushPractical={handlePushPractical}
            onDisqualify={handleDisqualify}
            mcqPushed={mcqPushed}
            allMcqSubmitted={allMcqSubmitted}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            <MonitorGrid sessionId={sessionId} candidates={candidateTiles} phase="mcq" onPause={() => pauseMutation.mutate()} onResume={() => resumeMutation.mutate()} isPaused={isPaused} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <AIMonitoringPanel alerts={alerts} behaviorScore={behaviorScore} isMonitoring={isMonitoring} onDismissAlert={dismissAlert} />
              <CaptureGallery sessionId={sessionId} enabled={phase === 'mcq'} />
              <FlagQueue flags={activeFlags} onFlagActioned={id => setResolvedFlagIds(p => [...p, id])} />
            </div>
          </div>
        )
      )}

      {phase === 'mcq' && ['MCQ_COMPLETE', 'MCQ_SUBMITTED', 'AWAITING_PRACTICAL'].includes(session.status) && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          <PracticalPanel sessionId={sessionId} assessmentTypeId={session.assessmentTypeId} mcqResults={mcqResults} onPracticalStarted={() => { setPhase('practical'); qc.invalidateQueries({ queryKey: ['proctor-session', sessionId] }) }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <AIMonitoringPanel alerts={alerts} behaviorScore={behaviorScore} isMonitoring={isMonitoring} onDismissAlert={dismissAlert} />
            <CaptureGallery sessionId={sessionId} enabled={phase === 'mcq'} />
            <FlagQueue flags={activeFlags} onFlagActioned={id => setResolvedFlagIds(p => [...p, id])} />
          </div>
        </div>
      )}

      {phase === 'practical' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          <MonitorGrid sessionId={sessionId} candidates={candidateTiles} phase="practical" onPause={() => pauseMutation.mutate()} onResume={() => resumeMutation.mutate()} isPaused={isPaused} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <AIMonitoringPanel alerts={alerts} behaviorScore={behaviorScore} isMonitoring={isMonitoring} onDismissAlert={dismissAlert} />
            <CaptureGallery sessionId={sessionId} enabled={phase === 'practical'} />
            <FlagQueue flags={activeFlags} onFlagActioned={id => setResolvedFlagIds(p => [...p, id])} />
          </div>
        </div>
      )}

      {phase === 'complete' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PostSessionPanel sessionId={sessionId} endedAt={session.endedAt || new Date().toISOString()} candidateCount={1} />
          {session.status === 'PENDING_PROCTOR_REVIEW' && (
            <div style={{ textAlign: 'center' }}>
              <Link href={`/proctor/reports/${sessionId}`} className="btn-primary" style={{ textDecoration: 'none', padding: '12px 32px', fontSize: '15px' }}>
                Review & Publish Report →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProctorSessionPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '40px' }}>Loading...</div>}>
      <SessionContent />
    </Suspense>
  )
}
